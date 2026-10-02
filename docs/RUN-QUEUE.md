# RUN QUEUE — free-stroke

> # ☀️ MORNING, 2026-08-28. EIGHT LANES RAN. READ THIS FIRST.
>
> **This file is 1449 lines and it does NOT read top to bottom** — the section below this box is
> dated 08-25 and tonight's work is at the BOTTOM. **Read these five, in this order. Everything else
> is detail.**
>
> ### 1 · The text animation, which is what you asked about
> ✅ **THE ARTIFACT IS GONE.** Open **`docs/verification/mark-2026-08-28/AB-stubs-Dstem.png`** —
> top is before, bottom is after. The fat black almond across the `D`'s stem, which you have called
> *"the artofacting and letter pieces missing"* since 08-04, **is not there any more.**
> **It was nine accidental taps**, each shorter than the pen is wide, so the pen could only stamp its
> own footprint — 2 % of the travel and **16.8 % of the clock.** See **`N8 · FINISH THE MARK`**.
> **And the mark is no longer tubing.** It was a **monoline**, one constant `radius: 11.29` for the
> whole word, and `stroke-width-models.md` specified the fix in full, with line numbers, and it was
> never built. Built tonight, and carried to **both** families — ⚠️ Desk Doodles was byte-identical
> after the first pass because `adapter.ts` never read the params.
> Then **`R1 · WRITE-ON TIMING`** for the other half, and it opens on a negative:
> **the velocity model was already correct too** — 22 of 22 strokes carry a real lognormal peak.
> **9 of 22 traced strokes are shorter than the nib is wide** (13.6 % of the clock), **all 21 pen
> lifts are a hard-coded 60 ms**, and **6 of 21 pen-downs are out of order.**
>
> ### 2 · The number that reframes every green in this repo
> **`🔴🔴🔴 THE ANSWER F22 UNLOCKED`** — `assert-gate-integrity` now runs (it refused to, before
> tonight) and says **about 52 of 101 gates cannot report the failure they exist for.**
> `DISPATCH.md` §2.6 says *"ten instruments have reported green while measuring nothing."*
> **Ten was optimistic by roughly a factor of five.**
>
> ### 3 · Decisions waiting on you — FEWER and NARROWER than this file used to say
> **`🟢 THE SIXTEEN, RECONCILED`** — five were already answered, two by a 3 KB rulings directory.
> **`🔴 PICK 5`** — **four films, not seven**, and 🔴 **the one the app opens on is the one your own
> 2026-07-31 ruling was written against.** Not flipped, because §2.8 says open picks stay open.
>
> ### 4 · The two findings that will save the next session the most time
> **`F21`** browser gates forge reds while a lane edits · **`F20`** two lanes in one working tree
> share one git index, so `git commit` takes the other lane's staged files (**fix: `git commit -- <paths>`**).
>
> ### 5 · The through-line, and it is the reason to read the record before working
> 🔴 **SIX times tonight the answer was already on disk.** Five queue rows opened against work that
> shipped 08-07 · two of your picks answered by `docs/rulings/` · the monoline fix specified in full
> and unbuilt · the velocity model already correct · **the nib already shipped in 2D and never
> carried to the solid** · **`render-freshness.mjs` already built for the staleness bug in F40.**
> **The work was rarely the hard part.**
>
> ---
> **EIGHT LANES, ALL LANDED:** N1 harness · N2 viewport · N3 export · N4 battery · N6 nib ·
> N7 manifest · N8 finish-the-mark · R1 research. **47 commits. tsc exactly 6 throughout.**
> **ROW IDS: highest in use is F41.** There were briefly two rows numbered F17; N2's was renumbered
> **F21** on 08-28. **A ledger with a duplicate id cannot be cited, which is the only reason rows are
> numbered.**
> ⚠️ **Counts measured while lanes were still committing are noted as unstable where they are.**
> Nothing in this file is rounded up.

---

## 🟢 RUN 2026-08-25 — FOUR GATES, ALL GREEN, ON THE REAL GPU

**`[MEASURED HERE]` I ran them. Not a lane, not a relay.** Headed, `ANGLE (Apple, ANGLE Metal
Renderer: Apple M4 Max)`, against a live dev server on `:3105`.

| gate | result | what it settles |
|---|---|---|
| `assert-letter-seam` | **20 rows ALL PASS** | The word carries **10 letters**. **0 of 148 060 triangles span two letters.** Every landed letter turns about ONE axis (spread `0.00e+0`). This is the slabs-sticking-out artifacting, closed. |
| `assert-drawin-attrs` | **19 rows ALL PASS** | The mark survives the dials. Ink at DRAW 93 % → 97 % → 100 % is **24 161 → 25 098 → 25 785 px**, monotone, never vanishing. 0 rejected draw calls. |
| `assert-fusion-combo-ui` | **14 rows ALL PASS** | 7 chips · **120 cells, 120 clicks, 120 distinct selections** · the 4 structurally empty cells are present and explain why · one undo step per selection. |
| `assert-fusion-two-dead` | **11 rows ALL PASS** | `viewTurn` head-on was genuinely dead (net **1.819**) and now acts (net **37.968**, ×21). `slowWeather` is alive on Loop (53.861) and dead on Burst (4.226); **Static Chrome** is the new cell that acts on Burst (89.958). |

**None of these is a vacuous green.** Every one carries a known-bad that was asserted to have
taken and was rejected: per-vertex ownership puts **788** spanning triangles back; both
attr halves off drops ink at 97 % to **0 px** with **256 rejected draws**; a grid whose buttons
all did the same thing fails the distinct-count row.

### 🔴 THE TRAP THIS RUN FOUND, and it is worth more than the four greens

**`assert-fusion-combo-ui` TIMES OUT HEADLESS AND PASSES HEADED.** Bare invocation the
call site asks for headless; `page.goto(..., { waitUntil: "networkidle" })` never resolves and
it dies at 30 s. `FS_HEADED=1` and it is 14/14. **Every gate in this repo uses `networkidle`**,
so this is not one bad call site. The repo already knew — commit `3884dd78`, *"all verification
runs HEADED with Metal, never headless"* — but nothing makes the bare invocation obey it, so
anyone running a gate the obvious way gets a timeout that reads like a broken feature.
**➜ Open row: make the shared launcher default headed, or make the timeout say why.**

### ⚠️ WHAT THIS DOES NOT SETTLE

**A green gate is not his eye.** These prove topology, ink counts and reachability. They do not
prove the beat looks right. F1 stays `NEEDS EYE`. And his *"still happens"* on 2026-08-20 was
almost certainly about **desk-doodles**, not this repo, since no free-stroke file moved that day.

---

---

# 🌙 RUN 2026-08-28 — OVERNIGHT, AUTONOMOUS

**His words, 2026-08-25 22:31: _"so its work tht needs to be done, not questions for me."_**
**And 2026-08-28 01:15: _"lets hand it off to fae and do it cleanly and write the run queue."_**

So this run does **not** gather picks. Every row below is work, and the four gates that were
already green are not re-run for the sake of a number. **Rows were written BEFORE dispatch.**

## `[MEASURED HERE]` before anything was dispatched, 2026-08-28

| what | measured |
|---|---|
| dev server | **UP on :3105** (HTTP 200) |
| disk | **392 Gi free.** No git worktrees. `~/.fs-lanes` is 31 dirs / 14 G, all 08-07. |
| tsc, bare | 2 PASS · 2 **UNSWEPT** · exit 3 — *the two route channels look for `:3000`* |
| tsc, `FS_PORT=3105` | **4 PASS · 0 FAIL · 0 UNSWEPT · fully swept.** Same six errors, same two files. |
| `HERO_URL=…` | **throws**, as `DISPATCH.md` §3 says it should |

🔴 **So the `PARTIAL` in the generated state block was never a defect in the gate.** Nothing
passed `FS_PORT`, so the gate looked for the app on `:3000` and honestly reported that it had
measured nothing. **That is the instrument working.** But every reader of `STATUS.md` since
08-25 has been shown `exit 3 (PARTIAL)` on page one and had no way to know the fix was one
environment variable. **➜ N1.**

## 🔴🔴 CORRECTION, 2026-08-28, 90 MINUTES IN — FIVE OF THESE ROWS WERE FIXED ON 08-07

**F5, F6, F7, F9 and F10 all read as ALREADY CLOSED on disk, in the code's own past tense,
by the 2026-08-07 lane run. The 8/20 journal was re-reporting defects that were already
fixed and already written up as explainers.**

`[MEASURED HERE]` — I opened every line below.

| row | what the queue said was open | what is on disk |
|---|---|---|
| **F9** `apiGrab` | takes the first canvas under `containerRef` | `viewport-3d.tsx:9903` — *"both **used to** resolve their target with `containerRef.current?.querySelector("canvas")`"*. `apiGrabInfo` at `:10284`, `firstUnderContainer` at `:10297`. **Explainer 35** is the whole story, and it records the 1584-px width as **not reproduced in 360 deliberate frames**, which is not the same as not real. |
| **F7** carve-graze comment | says the gate *"has never existed"* | The correction of the correction is **already in the file**, and the row's line numbers drifted. Not at `:9176`. The 08-04 block is at `:10452`; `:10466-10483` already says `assert-carve-graze.mjs` exists at 12 188 bytes with an mtime. |
| **F5** `setFlatten` | validates nothing | `:1263` — *"carries no check at all. So `setFlatten({ flat: 0 })` **used to** return"*. |
| **F6** `planFrames` | assumes the reveal ends full, 18 blank frames | **Explainer 38** carries the post-fix measurement **at the real Video button**: *"Vanish **59 → 41 frames**, `grow` byte-identical."* `frame-plan.ts` carries the machinery: `:172` the blank-hold escape hatch, `:236` a flag for a hold dropped because it would be blank, `:348` every hold frame clamped to 1. |
| **F10** `geometry-baseline.mjs` | hard-codes `:3000` at `:121` | `:31-40` — *"it **hardcoded** :3000"*, and it now imports `LAB_URL` from `./lib/dev-server.mjs`. **The only `3000` left in the file is `{ timeout: 30000 }` at `:135`, a 30-second timeout.** The row was a pattern match on a timeout. **Explainer 28** names this exact file as the one a `grep … assert-*.mjs` had missed. |

### 🔴 WHY THIS KEPT HAPPENING, because the mechanism is one layer deeper than 08-25 found

On 2026-08-25 the lesson taken was *"a journal entry is evidence something was SAID, never
that something was BUILT."* **That was right and it was not enough.** It explains why the
8/20 claims had no artifact. It does not explain **this**, which is the opposite failure:

> **The 8/20 lanes were describing real defects. The defects were simply already fixed —
> three weeks earlier, by the 08-07 run, with an explainer each.** So the queue seeded from
> that journal opened five rows against closed work, and tonight four lanes went out to fix
> things that `docs/explainers/28`, `35` and `38` had already closed and documented.

**The check that catches it is one grep and nobody ran it: search `docs/explainers/` for the
symptom before opening a row.** This repo's explainers are unusually good — each one names
the mechanism at `file:line` and carries the post-fix measurement. **Five rows died to not
reading an index that was sitting in the same directory.**

⚠️ **And note the shape, which explainer 43 already named as the night's deepest finding:**
*"an instrument has a SUBJECT — the thing it actually touched — and a CLAIM — the thing its
output is about."* A queue row has the same two halves. These five rows' subject was a
journal; their claim was the repo. **Nothing was checking that they were the same thing.**

### ✅ WHAT SURVIVES, and it is small and it is real

**Everything measured on 08-25 or later stands. Everything inherited from the 8/20 journal is
now suspect until someone opens the lines.**

- 🟢 **The headless `networkidle` trap** — measured 2026-08-25, not inherited. `assert-fusion-combo-ui` dies at 30 s bare and is 14/14 headed. **This is the one piece of engine work in tonight's queue that was never already done.** → N1 fault (c).
- 🟢 **The port default** — measured tonight. Bare gives 2 PASS / 2 UNSWEPT / exit 3; `FS_PORT=3105` gives 4 PASS fully swept. → N1 fault (a).
- 🟡 **F5 needs one more look, not a rebuild.** The landed validator must validate **PER KEY** — `FlatState` has 13 keys, `color` is a string, `letters` an array. A blanket-numeric check rejects two valid keys. → N2.
- 🟡 **F6 may be closed but UNGATED.** `assert-export-plan.mjs` reads 11 PASS and did not catch the ends-full defect when it was live. **A fix that no gate would redden can come back silently.** That row is genuinely open. → N3.
- 🟢 **F11, the battery's real state, is untouched by all of this** and remains unknown. → N4, running on a frozen clone at `6eb76ae6`.

**➜ NEW STANDING RULE, and it belongs in `DISPATCH.md` §1 pre-flight: before a row is opened
against a defect, grep `docs/explainers/` for the symptom. An explainer here is the record of
a fix, with the mechanism and the post-fix number. Opening a row against closed work costs a
lane.**

## Lanes dispatched tonight

| # | lane | owns (exclusive) | job |
|---|---|---|---|
| N1 | **HARNESS** | `scripts/verify/lib/browser.mjs` · `lib/dev-server.mjs` · `geometry-baseline.mjs` · `DISPATCH.md` §3 | The headless trap (`assert-fusion-combo-ui` dies at 30 s bare, 14/14 headed). Port discovery so a gate finds a live server instead of reporting UNSWEPT. `geometry-baseline.mjs:121`'s hard-coded `:3000` (**F10**). |
| N2 | **VIEWPORT** | `components/viewport-3d.tsx` | **F5** `setFlatten` validate-per-key + its gate row · **F7** the stale correction at `:9176` · **F9** `apiGrab` takes the first canvas. All three live in this one file, so one lane holds it. |
| N3 | **EXPORT** | `lib/export/frame-plan.ts` · `lib/export/index.ts` · `assert-export-plan.mjs` · `assert-export-window.mjs` | **F6** — re-derive the *"reveal ends full is false in 5 of 8 states → 18 blank frames"* claim on disk **before** fixing anything. It is a `[LANE CLAIM]`. |
| N4 | **BATTERY** | a frozen APFS clone at HEAD, own port, `docs/verification/battery-2026-08-28/**` | **F11** — the browser battery's real state is **UNKNOWN**, not green. Runs it on a tree nobody is editing, so N2/N3's hot reloads cannot forge a red. Baseline for the after-diff. |

**Why N4 runs on a clone:** N2 and N3 edit app source, the dev server hot-reloads, and a battery
reading a mid-reload page produces reds that are not regressions. That is the same class of error
as reading the 8/20 journal for repo state — the artifact is real, what it is evidence *of* is not.

| # | item | status | note |
|---|---|---|---|
| N1 | 🟡 **Gates default to a port nothing is on, and to a mode that hangs** | **RUNNING** | Two faults, one lane. **(a)** `FS_PORT` defaults to `3000`; this repo's server is `3105`, so the obvious invocation reports UNSWEPT and the state block has printed `PARTIAL` on page one since 08-25. **(b)** bare invocation asks for headless, `waitUntil:"networkidle"` never resolves, dies at 30 s — while `FS_HEADED=1` is 14/14. ⚠️ **`DISPATCH.md` §3 and commit `3884dd78` contradict each other** on headless: §3 says *"headless is fine and is Sebs's preference"* with a 121-vs-120 rAF measurement; the commit says *"all verification runs HEADED with Metal, never headless."* The later measurement wins, and the loser gets struck rather than left to be found again. |
| N5 | 🟡 **`STATUS.md` shows `exit 3 PARTIAL` with no way to see it is a port** | **QUEUED** | Falls out of N1. The state block is generated and must stay generated — the fix is in what `state.mjs` measures, never a typed correction. |

## 🔴🔴 N6 · THE ANSWER TO "WE FAILED FOR WEEKS" — THE MARK IS A MONOLINE, AND THE FIX WAS WRITTEN DOWN AND NEVER BUILT

**His words, 2026-08-28 01:43 and 01:45:** *"we need get that text aniamtion perfetct bigest blocker
and we failed for weeks getting it right"* · *"the desk doodles like its all kind of crappy and the
way it writes in is ass still."*

`[MEASURED HERE]` **I filmed it, headed on the M4 Max, and I looked at the frames.** Not a gate,
not a relay. `docs/verification/writein-2026-08-28/`.

**What I saw, in two states:**

- **At 3 s, mid-write, 2D.** The letterforms are decent. The ink is **flat pure black with hard
  edges** — no width variation, no density, no texture. ⚠️ And **a detached fragment sits AHEAD of
  the write position**, past the `o` of `Doodles`. Ink arriving ahead of the pen.
- **At 8 s, settled, 3D.** The word has become **uniform-diameter grey tubes with rounded
  hemispherical caps.** Play-Doh worms. Every stroke the same thickness. The `D` that was a crisp
  angular letterform in 2D is a noodle in 3D. **The 3D pass destroys the letterform quality the 2D
  pass had.**

**THE MECHANISM, and it is one line.** `window.__heroPenTip` reports `mode: "reed"` with a single
`radius: 11.290141859013586` for the **entire word**, and `lib/pen-reveal.ts:623` reads:

```
const R = Math.max(1e-6, inkDiameter / 2)
```

**One constant radius.** A reed pen is *by definition* a broad nib whose width varies with
direction. **The name does not match the behaviour, which is `DISPATCH.md` §2.7's definition of a
defect.**

### 🔴 AND THE REPO ALREADY SOLVED THIS ON PAPER

`docs/research/stroke-width-models.md`, **1 515 lines**, opening line:

> *"how thick the mark is once it gets there — **which is the part we currently do not model at
> all**."*

It is not a sketch. It carries the law, the prohibitions, and the code sites:

> *"**Implement the broad-nib model as a global affine map.** Width from stroke direction against a
> fixed nib angle, no pressure involved, no new width channel … in 3D you do not evaluate that
> formula at all — you get it for free by pre-transforming the centreline with the inverse of the
> nib's own affine map, sweeping the round tube we already sweep, and mapping the vertices back.
> That is a generalisation of code `lib/geometry-engines.ts` **already contains** … so the nib
> costs **one 3×3 matrix and no new geometry path**."*

`h(ψ) = √(a²sin²ψ + b²cos²ψ)`, ψ = θ − α.

**It even rules out the two wrong turns, with measurements:**
- **Not pressure.** *"The existing channel caps stroke contrast at **2.077 : 1** … A broad nib runs
  **5:1 to 10:1**."* And *"the pressure channel is a lie, not a gap"* — `PointerEvent.pressure`
  reports `0.5` for a mouse, `app/page.tsx:190` bakes a constant `0.6`, the capture font writes none.
- **Not velocity.** *"a velocity-driven width model would be a curvature model wearing a hat, and we
  already have a curvature model."*
- **0°, not 30°.** Johnston 1906 teaches the chisel edge parallel to the writing line. *"The
  familiar 30° is later teaching tradition."*

And it names every site: **`lib/flat-ink.ts:104-106`** the 2D half is `ctx.lineWidth` with round
caps · **`geometry-engines.ts:1400-1404`** Extrude's ribbon, *"directional in its normals, monoline
in its silhouette"* · **`:5532-5545`** the Z pre-scale the nib affine generalises · Inflate sweeps
an ellipse locked to (across-stroke, +Z), *"a pen held permanently flat to the page."*

### 🔴 SO THIS IS THE SHAPE OF THE WHOLE NIGHT, FOR THE THIRD TIME

Five queue rows were opened against work that shipped on 08-07. Two of the sixteen picks were
answered by a 3 KB rulings directory nobody read. **And the biggest blocker in the project has had
its fix written down, in full, with the line numbers, and nobody built it.**

⚠️ **The pattern is not that the work is hard. It is that the record is not read.** Three
independent instances in one night, each costing weeks or lanes.

**➜ N6 dispatched on Opus.** `DISPATCH.md` §0.5 puts engine math on Opus and this is engine math.
**Fable earns its cost later**, choosing the nib's axis ratio and angle by eye once the mechanism
exists — which is exactly §0.5's *"the one place Fable earns its cost is authoring the hero beat's
key shots, and only once the board is gated."*

⚠️ **`a:b` and `α` are HIS PICKS**, shipped as dials with a recommendation, never hard-coded. §2.8.

### 📽 THE 40-FRAME FILM — what the write-in actually does, measured 2026-08-28

`[MEASURED HERE]` `docs/verification/writein-2026-08-28/seq/`, 40 grabs through the live write,
headed on the M4 Max, composited on white before measuring. **`grab()` returns a TRANSPARENT png,
so an ink threshold on it reads every pixel as ink.** That trap ate a whole capture run tonight and
is exactly the *"a contact sheet can lie"* trap the old handoff lists. Composite first.

| what | measured |
|---|---|
| the write completes | **frame 029**, ink 27 143 px, and then **holds identical for 7 frames** |
| the 2D→3D handover | **frames 035→036.** Ink **lost 6 875**, gained 6 149, **net −726**. |
| where the loss sits | **every 100 px band across the whole word** — `{500:291, 600:1691, 700:874, 800:724, 900:747, 1000:471, 1100:1027, 1200:841, 1300:209}` |

➜ **So the handover loss is the whole mark re-rendering as tubes, not a letter piece vanishing.**
Worth knowing, because *"letter pieces missing"* has been read as a topology bug and here it is a
2.7 % uniform thinning. **`assert-letter-seam` was right to pass** — this is not a seam defect.

### 🔴 TWO ARTIFACTS I COULD SEE, and one of them SHIPS

**1 · Ink arrives ahead of the pen, then the gap closes.** Frame **004** carries a **66 px void** at
x 682 with ink on both sides: the `D` is finished and a **detached dash** floats to its right. The
void shrinks to 12 px by frame 005 and closes by 008. Frame 007 does it again at x 771 (21 px).
⚠️ **This may be legitimate** — a pen lift from the `D`'s exit to the `e`'s entry is a real thing a
hand does. What makes it read as a defect is that nothing marks the lift: the fragment simply
appears and sits there for three frames. **That is a TIMING question, so it is R1's**, not a
topology bug. *(The persistent gaps at x 1065 and x 1201 are in the final word too, so they are
inter-letter spacing and not defects.)*

**2 · 🔴 A blob that is in the FINAL FRAME.** At the top of the `D`'s stem, **frame 039**, two marks
cross the stem that do not belong to a `D`: a **thin horizontal bar** extending well to the stem's
left, and beneath it a **fat almond-shaped blob**, wider than tall, with pointed ends. A `D` is a
stem and a bowl. **This is in the shipped mark, not a transient.**
`docs/verification/writein-2026-08-28/seq/STEM-039.png` at 8×.

➜ **Hypothesis handed to N6, as a hypothesis and not a finding:** a very short entry tick swept by a
**constant 11.29 px radius** produces exactly a lens. The blob reads ~31 px wide against a ~10 px
stem, and a round brush of diameter 22.58 swept along a ~9 px segment would be ~31.6 px wide. ⚠️ Its
~14 px height does **not** match a round brush and I have not accounted for that, so **N6 measures it
rather than repeating my arithmetic.**

**If that hypothesis holds, the nib is a CORRECTNESS fix and not only a look fix** — a broad nib at
Johnston's 0°, thin in the vertical axis, renders that horizontal tick as a hairline instead of a
blob. And it is falsifiable without taste entering: after N6's change the blob is either there or it
is not.

### 🟡 THE SECOND HALF, WHICH NOTHING IN THIS REPO COVERS

Width is only one of the two faults. **The other is time**: stroke order and ductus, pen lifts and
the gaps between them, velocity through a stroke, and the leading edge — that detached fragment
ahead of the pen. `stroke-dasharray` and trim-path look fake even at variable width, **so the
remaining tell is temporal.** → lane R1, writing `docs/research/write-on-timing.md`.

## ✅ N2 · VIEWPORT — LANDED 2026-08-28. THREE ROWS STRUCK, THREE FOUND.

**It changed no code, because there was nothing left to change.** `05c541a7`, evidence only.
It verified against the interface rather than against the write-up, which is the whole reason
its return is worth more than a patch would have been.

🔴 **The row that sent it was quoting a section that retracts itself.** Explainer 24 §8's own
header reads **`~~QUEUED, not fixed~~ DONE, 2026-08-07 — see §9`**. The 8/20 lane read the
struck-through text.

**Every line number in the F5 and F7 rows had drifted**, which is why "verify it by opening it"
is in the brief: `FlatState` `:870`→**`:919`** · interface close `:2060`→**`:1240`** ·
`setFlatten` `:9144`→**`:10368`** · the F7 comment `:9176`→**`:10446-10495`**.

| # | row | verdict |
|---|---|---|
| **F5** | `setFlatten` validates nothing | 🟢 **STRUCK.** Closed 08-07, and it validates **per key**, which was the open question. `FLAT_STATE_KEYS` `:1277` · `isValidFlatState` `:1387` · setter guarded `:10369` · **compile-time exhaustiveness at `:1294-1296` makes a fourteenth channel a build error.** 13 keys counted off the interface by hand: 11 numeric in `FLAT_STATE_NUMERIC` `:1316`, `color` a string, `letters` through `isFlatLetter` `:1332`. `assert-hero-flatstate` headed on the M4 Max: impossible key **FALSE** · 11/11 malformed refused · **17/17 legal ACCEPTED**, the row a blanket-numeric check would fail · known-bad armed, **reproduced the defect at 9 162 px**, disarmed. |
| **F7** | the carve-graze note says the gate never existed | 🟢 **STRUCK.** The dated correction was already at `:10466-10495`; the 08-04 stale block at `:10452` is quoted **on purpose**. It ran the gate rather than reading about it: **9 rows ALL PASS, exit 0**, with its own reversed-arms known-bad rejecting on **6/6** frames. **It left the comment alone** — *"adding a second date would start the accretion the note warns about."* Correct call. |
| **F9** | `apiGrab` takes the first canvas | 🟢 **STRUCK, and the MECHANISM IS REFUTED**, which is better than finding it fixed. The frame is not in this repo; it found it at `~/.fs-lanes/laneH/…/film-rev-all/`. **All 120 frames measured, no sampling: 7 at 1584×1468, exactly f113-f119.** It opened f112 and f113: same mark, **same vertical scale**, wider frame, the bar's rounded caps visible at 1 020 px inside 1 584. **More horizontal extent at unchanged vertical scale is ONE canvas that got wider, not a second canvas.** A grab of `drawing-canvas.tsx` would show different content entirely. Fix was already in regardless: `glCanvasRef` `:10256` resolves by identity. |

### 🔴 F15 — `frame-guard.mjs` collects the exact evidence for F9 and asserts nothing on it

**`[MEASURED HERE]`** `scripts/verify/lib/frame-guard.mjs` declares
`grabs = { n, sizes, wrongSubject, multiCanvas, last }` at `:399`, writes it at `:549-554`,
publishes it in the report at `:682` — and **no consumer in `scripts/verify/` reads it.**
Grepped: zero hits outside the file. `ok` is `refusals.length === 0`, and **a mid-run size
change never becomes a refusal**, so a capture whose frames change dimensions is still written
to disk as fine. *A check that blocks nothing is a comment.* Wants one refusal kind plus a
known-bad that forces a resize and requires red. N2 did not patch it: shared lib, consumers it
does not own, and the defect does not reproduce.

### 🔴 F16 — `assert-hero-flatstate` is 19 PASS / 4 FAIL, and one red is a tripwire that fired

**`[MEASURED HERE]`** headed, real GPU, 2026-08-28. The row
*"the calibration arm was CHOSEN ON THIS SURFACE, not inherited"* says in its own text:
**_"If this row ever goes red the host's defaults have moved and the calibration needs
re-picking, which is the point."_** **It is red.** `{depth: 1}` now moves **8 557 px** on this
pose where it needs `< 200`. Three more: `squashY` contact pinning (bottom 543→547, needs ≤ 2),
the dead-on shadow pool, and the `jointBreak` control (21 675 px against 8 493, no override).
**All six `setFlatten` rows are green, so F5 is unaffected.** ⚠️ **This is a designed instrument
telling us something moved. It is not noise.**

### 🔴🔴 F21 — BROWSER GATES ON THE SHARED `:3105` FORGE REDS WHILE ANOTHER LANE EDITS

**`[MEASURED HERE]` and it is the night's second-best finding.** `assert-stroke-schedule.mjs`
threw **twice, at two different sites** — `:692` *"undefined (reading 'frontView')"* and `:1189`
*"null (reading 'querySelectorAll')"* — with a **different FAIL row each run**. Meanwhile
**735 files under `.next/` were touched in 60 minutes** and `lib/export/frame-plan.ts` was
written at **01:35:46 mid-battery** by lane N3. **Hot reload removes `window.__captureHarness`
out from under the gate.** §14's eight `setFlatten` rows **never executed in either run**.

**So a red from a browser gate run on a shared dev server, while any lane is editing app source,
is not evidence about the app.** This is the same family as everything else tonight: the
instrument's SUBJECT was a tree being rewritten under it; its CLAIM was the product.

➜ **Either browser gates get a frozen tree, or they get exclusive use of the server.** Handed to
N1, which owns the launcher. **It is also the retroactive justification for running N4 on a
frozen clone, a decision taken tonight on suspicion and now measured.**

## 🟢 THE SIXTEEN, RECONCILED AGAINST HIS OWN RULINGS — 2026-08-28

**His word, 2026-08-25: _"so its work tht needs to be done, not questions for me."_ So they were
reconciled instead of forwarded.** `HANDOFF.json` already forbade putting any of them to him
without checking `docs/rulings/` first. That check has now been done, against all four ruling
files and against `DISPATCH.md`.

**Result: sixteen is not the number. Five are already answered, one is a defect and not a pick
at all, and one is being closed by measurement tonight. Seven or eight genuinely reach him.**

| # | pick | verdict |
|---|---|---|
| **11** | the 15 sub-threshold neighbour pairs — cull or keep? | 🟢 **ANSWERED by his 2026-08-03 ruling.** *"Fusion means everything fuses. There must be at least one fusion for every possible combination of styles — the full power set, **not a curated handful**."* Culling near-neighbours is curating. The recommendation already on the row (*"a list to look at, not a defect list"*) is what his ruling says. **Do not ask him.** |
| **12** | should more cells ship on Arc? | 🟢 **ANSWERED, same ruling, by its scope.** The 08-03 call is about the power set of STYLES, and Drive is a separate rail — 114 of 120 on Loop matches the shipped rail. No change is the correct read of a ruling that does not reach this. |
| **13** | flip the 28 headed capture tools to headless? | 🟢 **BEING CLOSED BY MEASUREMENT, not by him.** The row's own recommendation was *"flip nothing wholesale."* Since then, headless was measured to **hang on `waitUntil:"networkidle"`** — `assert-fusion-combo-ui` dies at 30 s bare and is 14/14 headed. ⚠️ **The row said the sharper question was the 14 headed GATES and that nobody had asked it. It is asked: it is lane N1's fault (c) tonight.** |
| **15** | `holdOnEmpty` has no panel pill | 🔴 **NOT A PICK. A DEFECT, and `DISPATCH.md` §2.7 already rules on it:** *"Names must match behaviour. A dial whose label does not describe what renders is a defect — wire it or remove it."* `[MEASURED HERE]` `lib/export/recorder.ts:126` ships the string *"Turn on \"hold on empty\" to keep it."* while `grep -rc holdOnEmpty components/*.tsx` returns **0 on all seven files**. A live toast names a control that does not exist. **The message is lane N3's to fix tonight. Whether a pill gets BUILT stays his** — it is a panel he has twice lost dials off the bottom of. |
| **5** | which of the seven films ships | 🟡 **STILL HIS, BUT THE FIELD IS NARROWER THAN SEVEN.** Two rulings eliminate rather than choose. **2026-08-01:** *"Desk Doodles' draw-in is the benchmark. The **sweep-reveal is rejected**, and **abrupt camera-angle changes** used to 'show it's 3D' **are rejected** — the 2D→3D read comes from the transformation, not from moving the camera."* **2026-07-31:** *"Every camera move needs a reason. Random angles are banned — that is what the storyboard was for."* ➜ **Any of the seven that carries a sweep-reveal or an unmotivated camera move is already out by his own word.** Nobody has run that filter. **Handing him seven when his rulings have already killed some of them is handing him a question he part-answered on 08-01.** |
| **16** | `assert-hero-flatstate`'s control-manifest entry | 🟡 **HIS, and the row says so explicitly** — *"Re-ruling is explicitly a human call."* Left alone. |
| **1-4** | the `e`, pen tip, 3D ink, `envGain` | 🟡 **HIS. Taste, on rendered evidence, correctly parked.** ⚠️ Pick 1 carries a note that may moot it: *"It is the FONT `e`; his traced handwriting's `e` is open (42×18) and **the page loads on traced**."* If the shipped path never renders the font `e`, the pick is about a surface he does not see. **Check before asking.** |
| **6-9** | timeline · authored vs recorded timing · product route or lab · iOS pass | 🟡 **HIS. Product-shape calls with recommendations already attached.** ⚠️ Pick 9 carries a real gap worth naming when it goes to him: **there is no iOS-UI doc in this repo.** PRD item 35 is one line. |
| **10** | Slow Weather's pale body | 🟡 **HIS, and protected.** §0.7 bars anyone else re-tuning a relationship he can still pick. `assert-fusion-two-dead` confirms it is alive on Loop (53.861) and dead on Burst (4.226), with **Static Chrome** the louder answer at the same address (89.958), one press away. |

### The thing worth keeping from this pass

**Two of these were answerable by reading four small files.** `docs/rulings/` is 3 dated files
and an index, about 3 KB total. **A question was carried for three weeks that a 3 KB directory
already answered.** That is the same shape as the five rows opened tonight against fixed work:
**the record had the answer and nobody read the record.**

**➜ Standing: `docs/rulings/` gets read before anything is called a Sebs-only pick.** It is the
cheapest file in this repo and it has now twice been the one that mattered.

## 🔴 PICK 5 · THE FILTER HIS OWN RULINGS ALREADY IMPLY — RUN 2026-08-28

**Nobody had run it.** Pick 5 has been carried as *"which of the seven films ships — HIS ALONE,
do not decide it"* since 2026-08-04. That is right about the choice and wrong about the field.
**Two of his rulings ELIMINATE rather than choose, and applying them is not deciding for him.**

- **2026-07-31**, verbatim: *"what the point of these cameer angels we get randomly"* → ruling:
  **"Every camera move needs a reason. Random angles are banned."** Its Why on the record:
  *"The beat came back with unmotivated dollies and cuts."*
- **2026-08-01**: *"Desk Doodles' draw-in is the benchmark. The sweep-reveal is rejected, and
  abrupt camera-angle changes used to 'show it's 3D' are rejected — **the 2D→3D read comes from
  the transformation**, not from moving the camera."*

`[MEASURED HERE]` — read off `lib/hero-motion.ts:178-302`, the film definitions themselves,
and the camera laws at `:100-130`.

| film | camera | verdict against his rulings |
|---|---|---|
| `shipped` | **`prior` — the four-move camera** | 🔴 **THIS IS THE FILM HIS 07-31 RULING WAS WRITTEN ABOUT, AND IT IS STILL THE DEFAULT.** |
| `solidFirst` | — | 🔴 **OUT.** The film's own text: *"**Its price is structural and is not tunable: there is no draw-in in this film.**"* His benchmark IS the draw-in. |
| `cutaway` | C-B desk | 🔴 **OUT.** Its own text: *"**The transform is never shown.** It is bought with absence."* His ruling: the read comes **from the transformation**. |
| `turnLands` | parked | ✅ **IN, and it is the ruling implemented.** *"Four camera phases stop existing and their seconds become holds."* |
| `popUp` | C-B `desk`, **from frame 0** | ✅ **IN**, and it guards the ruling by construction: *"gravity may never be retconned. If the page is revealed to be a desk only at the moment the mark stands, **the stand reads as the camera moving**."* ⚠️ Its stated price is a brand call and is his: *"the dead-on 'this is exactly your drawing' frame does not exist in this film."* |
| `standTurn` | parked | ✅ **IN.** *"with the camera still parked."* |
| `letterByLetter` | C-A `deadOn`, parked | ✅ **IN.** His own idea #3 and the board's flagship. |

### 🔴 THE FINDING, and it is not about which film ships

**`DEFAULT_HERO_MOTION` is `shape: "shipped"` + `camera: "prior"`** — `lib/hero-motion.ts:1626`
and `:1631`. The comment sitting on that line says it plainly, and says the cost of moving it:

> *"THE SHIPPED FOUR-MOVE CAMERA IS THE DEFAULT, DELIBERATELY. Every camera assertion in
> `scripts/verify/` reads `DEFAULT_HERO_MOTION`, so flipping this default is a pick with a
> regression bill attached, not a tidy-up. The three parked laws are one click away in the panel."*

**So the beat the app loads on is the one carrying the unmotivated camera moves he ruled against
on 2026-07-31, four weeks later.** The three parked camera laws that satisfy his ruling are all
built, all gated, and one click away — and none of them is what opens.

⚠️ **NOT CHANGED, and deliberately.** `DISPATCH.md` §2.8: *"Open picks stay open. Sebs-only calls
are kept as dials and surfaced in prose with a recommendation. Never silently defaulted."* The
default is exactly such a call, it carries a stated regression bill, and flipping it unasked would
be the silent default that rule forbids. **It is surfaced with a recommendation instead.**

**RECOMMENDATION: `turnLands`.** It is the minimum re-cut of what is already built, every
mechanism in it is *"already gated 8/8"* by its own note, and it is his 07-31 ruling expressed as
a film rather than as a complaint. `letterByLetter` is the more ambitious answer and is his own
idea, but it is a bigger move and its global channels are parked.

**What he actually has to decide is now four films, not seven, and one of the four is the current
default that his own ruling argues against.**

## 🔴 F17 — SIXTEEN QUESTIONS THAT WERE NEVER ASKED

**Sebs, 2026-08-25: _"16? i hsouldnt have any from wht i rmmebr."_ He is right.**

`HANDOFF-TO-OZ.md` §4 gathered *"SIXTEEN DECISIONS, HIS ALONE"* at **10:0x on 2026-08-07**.
**`[MEASURED HERE]` his last message in this repo that day was 09:32** (`rm -rf ~/.fs-lanes`,
then *"Okay so make sure it is enforced and run the agents"*). The section was written about
thirty minutes after he stopped, into a document addressed to **Oz**, and from **08-08** his
journal is entirely portfolio work. **He was never asked. That is why he does not remember.**

⚠️ **An earlier version of this queue called them "the real backlog, open since 08-07, waiting
on him." That was wrong** and it is the same error class as the 8/20 one: a document said a
thing, and I reported the document instead of checking whether it ever reached him.

**BEFORE ANY OF THE SIXTEEN IS PUT TO HIM, RECONCILE AGAINST `docs/rulings/`.** Two look
already answered by his own rulings:
- **`2026-08-03`** — *"Fusion means everything fuses. There must be at least one fusion for
  every possible combination of styles, the full power set, not a curated handful."* That is a
  standing ruling and it bears directly on picks **10-12**.
- **`2026-08-01`** — Desk Doodles' draw-in is the benchmark; the sweep-reveal is rejected and
  abrupt camera-angle changes are rejected. Bears on pick **5**, which film ships.

The handoff also records that he already answered map §9 picks **1, 2 and 5**. **Asking him a
question he has already ruled on is its own defect**, and it is worse than not asking, because
it tells him the record was not read.

---

## 🔴 OPEN — HIS ASKS — reconciled against tonight's measurements, 2026-08-28

⚠️ **This table was written from the 8/20 journal. Tonight's film supersedes most of it.** The rows
below now carry what was MEASURED, and the old `[LANE CLAIM]` narratives are struck where a
measurement replaced them. The full detail is in the N6 and film sections above.

| # | item | status | what tonight measured |
|---|---|---|---|
| **F1** | 🔴 **"the artofacting when drawing and letter pieces missing still happens"** | 🔴 **CAUSE FOUND. NOT FIXED.** | **`[MEASURED HERE]` I filmed it and looked.** The old row's 6-vs-8-vs-10-pieces story is **struck** — it rested on the 8/20 journal. **What is actually there:** ① the mark is a **monoline**, one constant `radius: 11.29` for the whole word, which turns a short entry tick into a **fat almond blob at the top of the `D`'s stem — and that blob is in the FINAL FRAME, so it ships**; ② at the 2D→3D handover the mark loses **726 px net, spread across every 100 px band**, so it is a uniform 2.7 % thinning and **not** a piece going missing — **`assert-letter-seam` was right to pass 20/20**; ③ ink arrives **ahead** of the pen at frames 004 and 007 with a 66 px void, which is probably a legitimate pen lift that nothing marks, so it is a **timing** question. ➜ **N6** has ① and ③ goes to **R1**. |
| **F2** | 🟢 **"one fusion for every possible combo of styles … 2 to the power of 7"** | 🟡 **NEEDS EYE ONLY** | Settled by instrument on 08-25: `assert-fusion-combo-ui` **14 rows ALL PASS** — 7 chips, **120 cells, 120 clicks, 120 distinct selections**, the 4 structurally empty cells present and explaining themselves. It **clicks** rather than injecting state, deliberately: *"a state-injection test has passed in this repo while a whole feature was unreachable by a human."* **Nothing is open here but his eye.** |
| **F3** | 🟡 **"slow weather and turntabel dont aniamte"** | 🟡 **HIS CALL, AND HALF IS DONE** | Two faults in one sentence. `viewTurn` was genuinely inert and is **FIXED** — net **1.819 → 37.968**, ×21, and I confirmed it by eye tonight: `viewTurn-before` frames 000 and 012 are indistinguishable, `viewTurn-after` moves. ⚠️ `slowWeather` is **alive on Loop (53.861) and dead on Burst (4.226)**, so the complaint is true of one shape and **the answer is a NEW CELL, which is his**. **Static Chrome** already acts on Burst at **89.958**, one press away. §0.7 bars anyone else re-tuning it. ⚠️ Note `net = max(netL1, netTone × 8)`: on the repaired `viewTurn` arm `netL1` is **−21.632**, so an L1-only instrument would report the fixed dial as dead. It separates on tone. |
| **F4** | 🟢 **A handoff — asked for 2026-08-20** | ✅ **DONE 2026-08-28** | Not a sixth document, which would only restart the staleness clock. **Five stale handoffs superseded in place**, each with a header naming what is false in **that** file with line numbers; `HANDOFF.json` brought current through `handoff.py` so a non-Claude-Code harness reads a contract rather than prose; `docs/README.md` reconciled. Commit `c4f307e3`. **Four of the five said *"no commits"* on page one**, which stopped being true on 08-24. |

---

## 🔴 OPEN — FOUND ALONG THE WAY (rows so they don't die in a chat reply)

| # | item | status | note |
|---|---|---|---|
| F5 | 🔴 **`setFlatten` — QUEUED SINCE 8/20, NEVER TAKEN** | **OPEN** | **`[LANE CLAIM · NO ARTIFACT ON DISK]`** written up in **explainer 24 §8** for whoever takes it after Lane B lands: the mechanism, the two neighbours to copy (`setPenTip` `:9148`, `setPenTipShape` `:9156`), the exact change, and **the gate row that must accompany it** — a sweep row calling `setFlatten` with an impossible key and **requiring `false`**. The lane corrected two of its own claims by opening the lines: `FlatState` is at `:870`, names `:872`–`:1174`, interface closes `:2060`; **not all 13 keys are numeric** (`color` is a string, `letters` an array) — so the queued fix says **validate per key, not blanket-numeric**. ⚠️ **`components/viewport-3d.tsx` was never touched by that session.** |
| F6 | 🔴 **`planFrames` assumed the reveal ends full — false in 5 of 8 states** | **FIX STATUS UNCONFIRMED** | **`[LANE CLAIM · NO ARTIFACT ON DISK]`** Lane P called this *"🔴 The defect"*: `travel`, `vanish`, `shrink`, `grow+rev`, `travel+rev` → **18 blank frames at 30 fps**. **It predates lanes B and H** — `reverse` flips the clock, not the phase, so the shipped transport toggle already did it. Filmed: unwired Vanish = 50 frames, **final 31 one still image of paper**. ⚠️ **A SECOND, SEPARATE defect underneath it WAS fixed** — with no hold, `planFrames` never emitted a clock-1 frame (last frame at clock **0.986537**, the mark **1.35 % unfinished**; the hold had covered that for every export ever produced), fixed by clamping the closing frame's instant, no-op on exact multiples so `assert-export-plan` (11 PASS) doesn't move. **Do not read the second fix as closing the first.** Re-derive before acting. |
| F7 | 🟡 **A stale correction inside `viewport-3d.tsx` tells readers a live gate is missing** | **OPEN** | **`[LANE CLAIM · NO ARTIFACT ON DISK]`** `viewport-3d.tsx:9176-9184` says `assert-carve-graze.mjs` *"has never existed"* and is *"currently UNGATED"*. Measured by the lane as **wrong on both counts**: it runs bare to **9 rows ALL PASS**, with **blind arms → exit 1** and **swapped arms → exit 1 on 6/6**, reproducing the file's own 08-04 header table bit-identically on a different bundler. The point worth keeping: **a correction that goes stale is indistinguishable from the error it corrected** — this one tells a reader a gate is missing when that gate is green and falsifiable, which is how a working control gets rebuilt by someone who believed the comment. Sits **four lines from the F5 change site**, so one pass fixes both. |
| F8 | 🟡 **Unexplained: two lanes' Mutant-B walks disagree** | **OPEN, RECORDED NOT PURSUED** | **`[LANE CLAIM · NO ARTIFACT ON DISK]`** Lane E reads `59164 → 58998 → 60118`; Lane D reads `59164 → 59258 → 59368`. **Both give drops 0/6 so the verdict is unaffected** — and Lane E said plainly it had **not accounted for the difference**. Left standing because an unexplained divergence between two instruments is a row, not a footnote. |
| F9 | 🟡 **Mid-capture canvas resize on one film take** | **OPEN, RECORDED NOT PURSUED** | **`[LANE CLAIM · NO ARTIFACT ON DISK]`** On the **third** film take only, frames 113–119 came back **1584×1468 instead of 799×1468** — the 3D canvas took full width mid-capture. Did not touch the gate or any byte-identity capture (all 799-wide). Suspect: **`apiGrab` takes the *first* canvas under `containerRef`**, so a second viewport mounting would do this. Evidence: `film-window/film-rev-all/f113.png`. |
| F10 | 🟡 **`geometry-baseline.mjs` — one snapshot still hard-codes `:3000`** | **OPEN** | **`[LANE CLAIM · NO ARTIFACT ON DISK]`** Lane F landed the `FS_PORT` conversion **in the canonical tree**; Lane H's snapshot still hard-codes `:3000` at `:121`. Lane H did not touch it — running the canonical copy would have written into a live lane's tree. ⚠️ Related and **worth generalising**: Lane E found its own gate honoured `FS_PORT` while **silently ignoring `HERO_URL`**, the legacy name **24 other files still use**. Pointed at the wrong tree it now produces **zero PASS rows and exit 1** rather than going quietly green. **`[LANE CLAIM · NO ARTIFACT ON DISK]` the other ~34 port-blind gates were deliberately not touched.** |
| F11 | 🟡 **`run-browser-battery.mjs` never run in that session** | **OPEN** | **`[LANE CLAIM · NO ARTIFACT ON DISK]`** The 8/20 lanes had **no capture tree by design** (§18.7), so most browser rows would red on missing frames. Same reason `run-battery.mjs` read **28/39 green, 593 rows** with **all 11 reds = `no frames at docs/verification/<x>`** — *not regressions*. **This means the browser battery's real state is UNKNOWN, not green.** |

---

## 🟢 LANDED — but read the caveat before trusting it

| # | item | status | note |
|---|---|---|---|
| F12 | 🟢 **A month of engine work is finally in git** | **DONE** `[MEASURED HERE]` | 2026-08-24. `5f3faa5f` routed the captures the docs cite out of `~/Desktop/style` (**617 files, 28 GB**, unrouted since February) into `docs/media/captures/`, gitignored. `4c752f1b` — **WIP: a week of engine work that had been sitting only in the working tree**, its own message calling it *"a checkpoint, not a claim that anything is finished or verified."* `099e1ccc` — the verification frames, split out so `git log` on the engine stays readable. **This closes the portfolio queue's row B16** (*"free-stroke working tree is 1,875 untracked paths ahead of HEAD — and two scrap rows rest on it"*): `pen-order-loop` and `freestroke-bead-run` no longer stand on unversioned text. **Go mark B16 closed in the portfolio queue.** |
| F13 | 🟢 **Data-safety: 134 rows, 0 failures** | **DONE BY INSTRUMENT · NOT EYEBALLED** `[MEASURED HERE]` | `docs/verification/data-safety/after/report.json`, 2026-08-24 11:39. Covers: nothing-stored reads `empty` not error · payload round-trip · **the version travels WITH the data, not only in the key name** · **the bare array currently on every user's disk migrates v0 → v1** · unparseable bytes read `corrupt` and yield NO data · a well-formed envelope of the **wrong kind** is refused · **a payload from a NEWER build is refused rather than coerced** · a corrupt or foreign payload is **KEPT ASIDE byte-for-byte, never deleted** (`freestroke.strokes.v1.quarantine`). 13 capture frames alongside (undo/redo, clear-undone, slider drag, corrupt boot, quota full, after-reload). |
| F14 | 🟢 **`assert-drawin-attrs` — the gate that could not fail, closed** | **NEEDS EYE** | **`[LANE CLAIM · NO ARTIFACT ON DISK]`** **9 rows → 19, ALL PASS, exit 0, twice.** New rows: `PRESENT` split from `MATCHES` (merging them is what made the old row unfalsifiable) · `cascade still HAS its letters` (`letterCensus`, never called before) · `no triangle straddles two letters` · `every letter id is a real number` · `the walk actually REFILLED` (non-vacuity) · `every in-place refill CLEARED the attribute it did not write` · **plus two new known-bad arms, drop-only and stamp-only, each asserted to have taken and required to be rejected every run.** Both of Lane D's mutants now FAIL (3 rows red / 1 row red) where the old seven predicates read **7/7 ALL PASS on both**. **One exemption, with a written reason**: `lettersMeshesWithoutStamp: 1` — one 4-vertex `opacity 0` helper geometry that is not a letter-bearing mark; a second entry sits at `0` recording that it must never be taken. Also designed out a real flake: `reDrive` now samples after **every** dial move. |

---

## ⚠️ REPO STATE — measured 2026-08-25

**`[MEASURED HERE]`, all of it.**

- **Branch: `v0/sebastianmmdesign-3308-12049aa9`, ahead 3 / behind 2 of its own origin.**
  **`main` is at `a6c001cb` and has NONE of the engine work.** Everything above lives on a
  v0-scaffold branch. 🔴 **This is a row in itself: decide whether it merges to `main`.**
- Working tree otherwise **clean** — only `.githooks/` and `docs/thinking/` are untracked.
- **4 stale `worktree-agent-*` branches** all parked on `main`'s `a6c001cb`
  (`a76b4f54f0faecc6f`, `a817f8e61b2be7d4d`, `a9af986ee89d755f7`, `a9f4cf19f28fa7293`).
  ⚠️ Do **not** bulk-delete — the sibling rule applies: a dead worktree may still hold
  modified tracked source.
- **`core.hooksPath = .githooks`** as of today 12:58 — the author-identity guard. Its own
  comment carries the measurement: of **792 commits made in August on `SXM4434/portfolio`,
  400 were NOT attributed to Sebs** (370 authored `arm <arm@local>`, 30 `Claude
  <noreply@anthropic.com>`), `author.login = null` on every one, none on his contribution
  graph. **`ALLOW_FOREIGN_AUTHOR=1` is the single-commit override.**
- **353 scripts in `scripts/verify/`**; 45 explainers, numbered to 49.
- **No dev server running** — free-stroke's is `:3105`
  (`node ./node_modules/.bin/next dev --webpack -p 3105`). The `:518x` / `:519x` / `:5501`
  node servers currently listening are **not this repo**.
- 🔴 **`docs/README.md` says it was last reconciled against disk on 2026-08-07.** It predates
  the entire 8/20 run and all three 8/24 commits. Its own header is the warning:
  *"An index that is 90 % right is worse than one that is openly incomplete."*
  Its `:58` also still repeats a *"181 times"* figure a lane flagged as a **symptom count**,
  not an incident count.

---

## 📍 WHERE THE TRUTH ACTUALLY LIVES

Read in this order, because each corrects the one before it:

1. **`docs/thinking/2026-08-20.md`** — the overnight lane run, verbatim. Session ended
   `13:20`, reason `other`. Transcript snapshot:
   `~/.claude/thinking/transcripts/20260820-132013-5633966b.jsonl`.
   ⚠️ Two session ids in one file (`5633966b`, `5071f9d6`) and **60 messages the submit
   hook never saw**, recovered by `reconcile-queued.py`. His asks are in there.
2. **`docs/thinking/2026-08-24.md`** — short. The commit session.
3. **The gate headers themselves** — `assert-fusion-two-dead.mjs`,
   `assert-fusion-combo-ui.mjs`, `assert-drawin-attrs.mjs`. In this repo the header is
   where a lane wrote down what it actually found; it outranks any summary of it.
4. **`docs/LANES-2026-08-07.md`** — the *earlier* 26-lane run. ⚠️ Its narrative stops
   after Lane O; per-lane truth is in `verification/lane-*/LANE-STATE.md`.
   Lane copies are at **`~/.fs-lanes/`** (32 dirs, all 2026-08-07), **not worktrees** —
   a worktree here is cut from an old commit and is not this repo.
5. **`docs/hero-beat-storyboard.md`** — ⚠️ 3,700 lines and it **reads back-to-front**.
   §1–§9 describe a beat that no longer exists. **Start at §11.9's header note.**
   The live beat is **12.3667 s / 371 frames, twelve phases.**
6. **The beat has one owner: `lib/hero-motion.ts`.** `scripts/capture/motion.mjs` is a
   downstream **manual paste** of its constants and **has been found stale twice in two
   days**. Nothing gates the paste.

---

## 📐 THE COUNTER METRIC — a legibility gate for the nib, measured 2026-08-28

`[MEASURED HERE]` A **counter** is the enclosed background inside a letter: the eye of an `e`, the
bowl of a `D`, the ring of an `o`. Measured by flooding the background in from the image border and
counting the enclosed regions that survive, minimum 20 px. Final settled frame, each engine:

```
free-stroke    8 counters   [4378, 2883, 446, 414, 234, 201, 109,  24]
desk-doodles   8 counters   [5325, 3306, 594, 574, 374, 333, 252,  98]   2D, frame 029
desk-doodles   8 counters   [5141, 3189, 568, 555, 356, 326, 245,  99]   3D, frame 039
```

⚠️ **CORRECTING MY OWN READ.** Looking at the frames I thought the counters were closing. **They are
not.** All eight survive on all three renders. What is true is that they are **choked**, and that
`free-stroke` is choked harder: every one of its eight is smaller than the matching desk-doodles
counter, and its smallest is **24 px against 98**, which is visually shut at this resolution while
remaining topologically open. **The measured version replaces the impression.**

### 🔴 AND THE TIP IS THE SAME OBJECT ON BOTH ENGINES

`window.__heroPenTip` returns **identical** values on `desk-doodles` and `free-stroke` —
`mode: "reed"` · `radius: 11.290141859013586` · `inkDiameter: 22.58028371802717` ·
`totalArc: 3897.1795982396343`. **So the monoline is global. It is not one engine's defect and the
nib fix should move both.**

### Why this is the gate N6 should carry

A broad nib at Johnston's **0°**, thin axis vertical, thins **horizontal** stroke segments — and the
top and bottom of an `e`'s eye are exactly those segments. **So a correct nib makes counter areas
GROW and lifts the smallest one off the floor.** That is measurable, it is untouched by taste, and it
is a **legibility** claim rather than an aesthetic one, which makes it the strongest argument the
change can carry. Gate rows handed to N6: counter count stays **8** (a nib that merges two letters is
a regression) · total counter area increases · **minimum** counter area increases. Calibrated by
setting `a == b`, which must reproduce the numbers above.

**Observed, not measured, so not a finding:** on `free-stroke` the `o`s read as lumpy polygons with
visible flat facets rather than round, and the `esk` cluster is a tangle. Whether that is the nib,
tessellation, or the source path is unknown.

---

## ✅ N3 · EXPORT — LANDED. F6 was closed in code and UNGATED, which was the real defect.

**`[MEASURED HERE]` 2026-08-28.** It derived the 8 states off `windowAt` in
`lib/stroke-schedule.ts:309` rather than off the row, and got the row's own list back:
**5 of 8 end empty** — `grow+rev`, `travel`, `travel+rev`, `vanish`, `shrink`.
`REVEAL_WINDOW_ENDS` at `frame-plan.ts:111-116` agrees cell for cell.

**Both fixes were already in and wired**: §W at `frame-plan.ts:48-128` and `:287`, the clock-1 clamp
at `:342-376`, the call site at `viewport-3d.tsx:12078` and `:12375`.

⚠️ **The row's frame counts were wrong and its INVARIANT was right.** Filmed twice at the real Video
button: **83 → 65** and **60 → 42**. Not *"50 → final 31"*. **The gap is 18 every time** — 600 ms at
30 fps less the closing frame. The absolutes move with pen duration; the gap does not.

### 🔴 THE FIND, and it is the row's real content

It put the assumption back (`holdSuppressed = false`) and re-ran. **`assert-export-plan.mjs` still
read 11 PASS · 0 FAIL.** The only guard that reddened computes `revealEnds` **itself** before handing
it to the module, so it never touched the app's copy. And `grep -rn __fsExportRevealEnds scripts/`
returned **0** — **the parked known-bad built for exactly this was read by nothing.**

➜ **Deleting one line from `viewport-3d.tsx` would have restored the defect with every gate green.**

**This is the state the ledger had no name for and now does: CLOSED IN CODE, UNGATED.** Being fixed
and being defended are different, and only one of them was ever tracked.

**Closed by two calibrated rows:** `assert-export-plan.mjs` **§9**, an 8-state tail census in the
model battery — bare **12 PASS · 0 FAIL**, `--mutate=endsfull` → **WELDED: travel(18), vanish(18),
shrink(18)**. And `assert-export-window.mjs` **§D**, which clicks the `Vanish` pill, clicks `Video`,
and measures **the file Chrome actually downloaded** — **36 PASS · 1 FAIL**, up from 26, with `grow`
byte-identical at `554c5771af0d57c7` and the calibration taken first.
Strip: `docs/verification/export-2026-08-28/real-button-films.png`.

| # | row | status |
|---|---|---|
| **F6** | ends-full — closed in code 08-07, **now gated at the button** | 🟢 **NEEDS EYE** |
| **F18** | the dropped-hold toast named a control nobody has | 🟡 **HIS HALF OPEN.** `recorder.ts:126` reworded to *"A reveal that ends on the finished mark keeps it."* Gated by a row that **derives** — it counts `holdOnEmpty` in `components/` and only then requires silence, **so building the pill relaxes the gate on its own.** Control is the old sentence. **Pill NOT built, and N3 recommends not building it**: the honest default already ships, the override stays open to a caller, and a blank held tail is a rare want on a panel that has lost dials off its bottom before. If he wants it, it belongs beside the reveal-window pills, not in the export bar. |
| **F19** | `assert-export-window.mjs` §B3 is flaky, and the bar is not why | 🔴 **OPEN.** Four runs, two trees: Δcx **0.247 PASS · 0.124 FAIL · 0.000 FAIL · 0.000 FAIL**, **including on pristine HEAD**, so it predates tonight. Cause: `getTotalDuration()` is first-to-last timestamp, so **the dead gap between the fixture's two strokes goes into the film's length** — on the 2164 ms run the whole reveal was over by **frame 5 of 67**. Re-aiming at the argmax was measured *before* deciding and still fails (0.087 against a 0.15 bar), so no bar was moved. Fix is the fixture. ⚠️ **The product question underneath is his: should an exported film spend 90 % of its length on a pause the hand took?** |

---

## 🔴🔴 F20 — TWO LANES COMMITTING IN ONE WORKING TREE SHARE ONE INDEX

**N3 caught this and it was mine.** Commit `0e0fd643`, *"verify: filmed the write-in"*, contains six
of N3's files under `docs/verification/export-2026-08-28/`.

**`[MEASURED HERE]` and the mechanism is worse than the obvious one. I did not use `git commit -a`.**
Every commit I made named its paths explicitly. **N3 ran `git add` on its own files, and my next
`git commit` committed the index — which by then held N3's staged work as well as mine.**

🔴 **So `DISPATCH.md` §4 does not cover this.** §4 declares **file** ownership, and file ownership is
exactly what both of us honoured: I never touched an export file and N3 never touched a queue file.
**The staging area is shared state that no ownership rule mentions**, and it silently merges two
lanes' work into whichever one commits first.

**Nothing was lost** — N3 confirms its work is safe on the branch — but the commit message is now a
lie about what the commit contains, and a `git show` on it attributes N3's evidence to a capture run.

**➜ THE FIX, and it is one flag: `git commit -- <paths>` commits ONLY those paths regardless of what
is in the index.** Every lane brief in this repo should say so, and so should §4. The alternative,
one clone per lane, is what N4 is doing tonight and it is heavier than this problem needs.

⚠️ **This is the same family as everything else tonight one more time: the instrument's SUBJECT (the
whole index) was not its CLAIM (my files).**

---

## ✅ N1 · HARNESS — LANDED `2ead54af`. AND IT KILLED THE PREMISE IT WAS SENT WITH.

### 🔴🔴 THERE WAS NO HEADLESS TRAP. THE PORT WAS THE TRAP.

**I briefed four lanes on a fault that does not exist.** The 08-25 note said
`assert-fusion-combo-ui` *"times out at 30 s headless and passes 14/14 headed"*, and every brief
tonight carried `FS_HEADED=1` because of it. **N1 measured it instead of inheriting it:**

| measurement | headless | headed |
|---|---|---|
| `networkidle` on `/` | resolves **1067 ms** idle, 11 064 ms busy | resolves |
| renderer string | `ANGLE (Apple, ANGLE Metal Renderer: M4 Max)` | **identical** |
| rAF over 2 s | **241** | 241 / 242 |
| `assert-fusion-combo-ui`, live server | **14/14, 18.6 s** | 14/14, 16.8 s |
| **18 runs** (3 gates × 2 modes × 3 reps) | **5 of 9 green** | **5 of 9 green** |

**All six gate-by-mode cells are unstable WITHIN one mode, so the mode is not the variable.**
`browser.mjs` is **unchanged**, and N1 says why in the right words: *"moving it would have been a
preference dressed as a fix."* **§3's headless sentence stands. `3884dd78`'s "never headless" is what
tonight's numbers do not support.**

⚠️ **The 30-second death was a gate aimed at a port with nothing on it.** One fault wearing two
names, and the second name survived three weeks because nobody re-measured it.

### ✅ The port, fixed properly

`FS_PORT` unset now **derives the port from the listening process whose `cwd` is this checkout** —
two `lsof` calls, ~160 ms, once per process. **Two servers on one tree throws** rather than picking.
Nothing serving this tree still falls back to 3000, **so the honest UNSWEPT survives.**

**It rejected three easier answers with the measurement that killed each:** `package.json`'s dev
script has no `-p`, so it declares 3000 and resolving it changes nothing · a candidate probe
first-hit-wins would have graded the wrong tree, since tonight `:3105` is this tree and `:3106` is
N4's clone · keeping 3000 and naming the live port improves the message and still cannot reach a
server two feet away.

**Bar met, bare, no env:** `assert-tsc-baseline` **2 PASS/2 UNSWEPT/exit 3 → 4 PASS/0 UNSWEPT/exit 0**.
`assert-fusion-combo-ui` **exit 1 in 1 s → 14 PASS in 18 s, headless.**
**9 known-bad arms, SOUND** — a foreign tree's server yields UNSWEPT, never a pass; empty machine
same; `lsof` off `PATH` same. ⚠️ Its first run **failed on N1's own bad fixture, not on the resolver**,
which is what a calibrated control is for.

### 🔴 N1c — THE BROWSER GATES ARE NOT DETERMINISTIC AGAINST A LONG-LIVED DEV SERVER

**`[MEASURED HERE]` and this is the finding of the lane.** An **unattended** page, on a server up
**2 d 3 h**, over 180 s: **30 main-frame navigations and a webpack hot update**, with
`sourceChangedUnderIt: **false**` on all 18 runs. **No source file moved. The server does it alone.**

Every red N1 measured was that arriving mid-gate — `Execution context was destroyed`,
`window.__captureHarness` undefined, a census reading a rebuilt surface — **including inside
`geometry-baseline.mjs --save`, a DISPATCH §3 required tool.**

⚠️ **This REFINES F21.** N2 attributed forged reds to another lane editing app source. That is real,
but it is not the whole mechanism: **the churn happens with nothing moving at all.** A frozen clone
does not protect against it either. ➜ **Restart the dev server before a battery, and re-run a red
before recording it.** Handed to N4, whose F11 numbers are affected.

### ✅ N1d — `sweep-browsers.mjs` was cited in three places and was not on disk

`lib/browser.mjs:77`, `assert-one-browser.mjs:475` and explainer 44 §5 all cite it. **It did not
exist.** *"Nothing read the registry but the launcher that writes it, so the half that survives a
session limit had no implementation."* Landed to the documented contract: **11 controls SOUND, 5
known-bad.** Live test: it named a planted orphan and `--kill` ended **exactly** it, leaving my
browser and N4's alone. **Exact pids, never `pkill -f`.**

### 🟢 F10 — STRUCK, and the "24 files" was a misreading

`geometry-baseline.mjs:121` is `async function capture(label) {`. `:40` imports `LAB_URL`. The only
`3000` left is `{ timeout: 30000 }` at `:135`. **Zero live paths read `process.env.HERO_URL`** — the
9 repo-wide hits are 5 docs, 2 comments, 1 deliberate mutant fixture, 1 header. **The "24 other
files" are 75 files importing `HERO_URL` as a module export, which is the design, not the debt.**

### 🔴 STILL OPEN, and N1 correctly refused to reach into files it did not own

| # | item | note |
|---|---|---|
| **F22** | 🔴 **`assert-gate-integrity` refuses to sweep — 28 pre-existing channel-K failures** | 3 missing manifest entries (`assert-arm-took`, `assert-harness-surface`, `assert-one-browser`) + 25 rotted citations. **"Can each gate fail?" is currently UNANSWERABLE.** Needs `lib/control-manifest.json`, which no lane owned tonight. ⚠️ **The instrument that exists to catch vacuous greens is itself not answering**, which makes this the most load-bearing open row in the file. |
| **F23** | 🟡 **N1's own controls exit non-zero and are in NO SWEEP** | `_probe-port-resolver.mjs` and `sweep-browsers.mjs --selftest`. It declined to add an `assert-*` gate because channel K discovers by prefix and `control-manifest.json` is not its file, so a new gate would have defaulted RED. **Correct call, and it leaves real controls unswept.** |

---

## ✅ F15 — CLOSED 2026-08-28. `frame-guard` collected the evidence for its own defect and judged none of it.

**`[MEASURED HERE]`** N2 found it while proving F9 was already fixed; the controller took it because
N1 had finished and no lane owned `scripts/verify/lib/frame-guard.mjs`.

`grabs = { n, sizes, wrongSubject, multiCanvas, last }` was declared, written on **every** frame,
published in the report — and **read by nothing**. Grepped: zero consumers outside the file. Since
`ok` is `refusals.length === 0` and nothing ever pushed one, **a run whose frames changed size
mid-capture came back `ok: true`.**

**Two refusal kinds, because they are two different lies:**
- **`GRAB-SIZE-CHANGED`** — the frames are not comparable to each other, so **every statistic in the
  report was computed over two populations.**
- **`GRAB-WRONG-SUBJECT`** — the grab resolved to a canvas that is not the one under test. Explainer
  43's family: *an instrument whose subject differs from its claim does not throw, it returns a
  well-formed answer to a question nobody asked.*

**Calibrated with a positive control**, because two must-fire arms would both pass on an instrument
that refuses everything:

| arm | required |
|---|---|
| size changes mid-run | **`GRAB-SIZE-CHANGED`, `ok === false`** |
| `firstUnderContainer: false` | **`GRAB-WRONG-SUBJECT`** |
| one size, right canvas | **no `GRAB-` refusal** |

**Self-test 20 PASS → 24 PASS · 0 FAIL · exit 0.** ⚠️ **The pre-existing MUST-NOT-FIRE arms still
hold, including the two that run on REAL stored captures** — 22 `verify-stack` frames and the
56-frame `dit_pulse` — **so the new rule does not fire on healthy data.** tsc exactly 6, both
routes 200. Commit `54a0e118`.

⚠️ **NOT wired into a sweep, and that is F22's fault, not a shortcut.** Channel K discovers `assert-*`
by prefix and `lib/control-manifest.json` carries 28 rotted entries tonight, so a new gate would
default RED. These controls live in `--selftest` alongside N1's two, which **F23** already records as
unswept. **Three sound instruments now sit outside every sweep. That is the cost of F22 staying open.**

---

## 🔵 N7 · THE MANIFEST — DISPATCHED 2026-08-28 (row written AFTER dispatch, which is this file's own rule broken)

⚠️ **The rule is "a row goes in BEFORE dispatch, not after the return." I dispatched N7 and wrote
this afterwards.** Recording it rather than back-dating it, because a ledger that quietly tidies its
own process failures is the thing this file exists to stop.

**The job: F22.** `assert-gate-integrity` refuses to sweep on 28 channel-K failures — 3 missing
entries (`assert-arm-took`, `assert-harness-surface`, `assert-one-browser`) and 25 rotted citations.
**Owns `scripts/verify/lib/control-manifest.json` exclusively**, and N6 has been told to hand its nib
gate's entry to me rather than write it.

🔴 **The brief's hardest line, because the easy version of this job is worse than not doing it:**
*a lane that re-points 25 citations at whatever line looks plausible produces a GREEN meta-gate that
certifies nothing — manufacturing the exact lie the meta-gate was built to detect, at 28× scale.*
So the bar is that **every repaired entry cites a REAL negative control**, an arm that feeds a
known-bad and requires rejection. **Where a gate genuinely has no control, the honest entry says so.**
The return must give the split — *repaired* against *genuinely has none* — not a flattering total.

It also has to prove itself: **mutate a gate so its control cannot fire, and require channel K to go
RED on that entry.** An entry nobody has seen reject something is a hope, not a repair.

**And the durable question it was asked:** the manifest cites by **line number**, which is why 25
rotted. **Is citing by TOKEN feasible?** If it is, that is the more valuable half of the lane, because
it stops the rot rather than clearing it once.

---

## ✅ N4 · BATTERY — LANDED. F11 CLOSED, AND THE ANSWER IS WORSE THAN "SOME GATES ARE RED".

# 🔴 **88 of 100 gates ran clean. ZERO of 100 were shown able to fail.**

**`[MEASURED HERE]`** on a frozen APFS clone at `6eb76ae6`, own server, own port. Report:
`~/.fs-lanes/battery-0828/docs/verification/battery-2026-08-28/REPORT.md`

| | model | browser | both |
|---|---|---|---|
| attempted | 47 | 53 | **100** |
| passed | 39 | 49 | **88** |
| failed | 8 | 4 | **12** |
| timed out at runner cap | 0 | 0 | **0** |
| **never run** | **0** | **0** | **0** |
| rows on clean gates | 832 | 1164 | **1996** |

Wall: model **1 m 29 s**, browser **43 m 33 s**, integrity **70 s**. Partition verified by both
runners — 100 discovered, 47 + 53, **overlap 0**. The model battery named the 53 browser gates it
would not run; the browser battery ran all 53.

### ✅ F11 — CLOSED. "Never run" is **0**.

The row said the browser battery's real state was **UNKNOWN**. It is now known.

### 🟢 BUCKET 1 IS EMPTY — no red in this run is the app being wrong

**All twelve reds were re-run. Ten reproduced, two did not.**
- **8 model reds are bucket 2 (missing input).** Two want an absent `docs/verification/fusion-combos/v1/liveness.json` — the whole directory is missing. **Six are PROVENANCE refusals**: captures dated 2026-08-04 graded against `lib/flat-ink.ts` at 2026-08-07 09:49, stale by ~60 h. 🔴 **Cost: 93 PASS rows on the scoreboard describe the 08-04 build, not `6eb76ae6`.**
- **4 browser reds are bucket 3 (harness).** `assert-export-app` and `assert-hero-k7-intact` went **green on re-run**. `assert-hero-word-legible` and `assert-still-export` reproduced 2/2, both dying waiting on harness globals.

⚠️ **The two that did NOT reproduce are the two that looked most like app defects.** `assert-export-app`
recorded a **166 ms** stroke from a gesture its own code drives for **≥572 ms**; run 2 read 831 ms,
22 PASS 0 FAIL. **A fragility, not a failure — but the product's claim is that the film is as long as
the gesture, and once it silently was not.** ➜ **F24**, below.

### 🔴🔴 BUCKET 4 IS UNANSWERABLE, AND THAT IS THE FINDING

`assert-gate-integrity.mjs` **exits 1 without checking a single gate**:

```
FAIL  K accepts the real one   *** 29 unexpected ***
NOT CALIBRATED — 1/34 wrong.
Refusing to sweep on an uncalibrated analyser.
```

**33 of 34 calibration cases pass. The one that fails is channel K's own POSITIVE CONTROL** — the arm
asserting K accepts a valid entry. **So the gate is not broken; it is refusing to sweep because its
self-check says it cannot currently tell a good entry from a bad one.** That is the gate behaving
correctly, and it is the strongest argument in this file for why F22 outranks everything else open.

**Reconciled by hand at `assert-gate-integrity.mjs:1230`: 3 missing entries + 26 rotted citations = 29
exactly.** ⚠️ **Not 28. N1's figure was 28 at a different commit; N4's 29 reconciles line by line.**
N7 has both numbers and has been told to report the one it measures.

🔴 **DO NOT READ TONIGHT'S 88 GREENS AS 88 GATES THAT CAN FAIL.**

### 🔴 THREE MORE, and the first is structural

| # | finding | why it matters |
|---|---|---|
| **F25** | **98 of 100 gates turn a crash into a non-zero exit with NO FAIL row.** Only `assert-data-safety` and `assert-stroke-schedule` convert a caught error into a row. | **Three gates did exactly this tonight.** Every scoreboard that counts rows sees the PASS rows printed before the crash and no failure; only the exit code carries the truth. ⚠️ N4 states its method plainly: a **structural grep**, with the execution proof being those three. |
| **F26** | **The meta-gate scopes itself to `scripts/verify/`** (`:2011`, `:1877`), so `docs/storyboard/tools/assert-moment.mjs` — **a gate the batteries DO run** — sits outside every integrity channel. | **The defect the batteries fixed on 08-07 is still open in the file whose job is to notice it.** |
| **F27** | `docs/verification/gate-integrity/report.json` is dated **2026-08-07 03:40** and **nothing on disk says so.** | A stale report that does not declare its age is the `HANDOFF-TO-OZ` failure in miniature. |
| **F24** | `assert-export-app` read a **166 ms** stroke from a gesture driven for **≥572 ms**, once, unreproduced. | The product's claim is that the film is as long as the gesture. **Recorded as a fragility, not a failure.** |

### ⚠️ N4 CORRECTED ME, and correctly

I told it a long-lived dev server was likely behind its reds, citing N1's 2 d 3 h measurement.
**N4's `:3106` server was 10 minutes old when the browser battery started**, so churn is a much weaker
explanation for its reds than for N1's. **It declined to inherit my framing and said so.** It also
declined to write a headless finding, leaving N1's 18-run measurement standing.

**Unresolved and stated as unresolved:** `assert-hero-word-legible`'s root cause. N4 killed two
hypotheses with measurement — **not** a missing `[data-word-input]` (both runs die **51 lines before**
`setText`, which kills MY hypothesis too) and **not** the 1600×1600 viewport (11/11 direct loads
attached both globals in 7-9 ms). Inside the probe's own session the globals never appear in 120 s.

---

## ✅ R1 · WRITE-ON TIMING — LANDED `c4c7632f`. `docs/research/write-on-timing.md`, 817 lines.

### 🔴 THE HEADLINE IS A NEGATIVE, AND IT IS THE FOURTH TIME TONIGHT

**The velocity model is already correct.** R1 probed the shipped hand: lognormal **mu −1.888,
sigma 0.243, overlap 0.494** — all inside the literature's ranges, overlap within **1.2 %** of the
recommended 0.5. The repo's own pacing instrument scores **22 of 22 strokes** with a real lognormal
velocity peak. **Weeks went into the hardest strand of this problem and it was finished.**

⚠️ **So the complaint was never the timing curve.** Same shape as the monoline, the five closed rows,
and the sixteen picks: **the hard part was already done and nobody knew.**

### 🔴 THREE MEASURED DEFECTS, all upstream of the velocity model

| # | defect | measured |
|---|---|---|
| **F28** | **9 of 22 traced strokes are SHORTER THAN THE NIB IS WIDE** | **4.9 units against a 22.6-unit nib.** Just **2.03 % of the pen's travel** but **13.6 % of the record's clock.** Each renders **~5.6× longer than the path that made it**, popping in whole, in clear air. 🔴 **THIS IS THE ALMOND BLOB.** A stroke shorter than the nib's own diameter can only produce the nib's footprint — my 31 px blob against a 10 px stem was exactly that arithmetic, and **N6's nib cannot fix it**: a broad nib still stamps its own shape, it just changes the shape. **The fix is a filter on the source strokes.** |
| **F29** | **Every one of the 21 pen lifts is exactly 60 ms** | `MS_GAP_BETWEEN_STROKES = 60`, `lib/pen-reveal.ts:1240`. **Not a distribution. A constant, twenty-one times.** Against Kandel et al. 2008's adult inter-letter intervals of **90 ms simple / 155 ms complex**, and Prunty's bands of 30-250 ms within a letter and 250 ms-2 s between letters. |
| **F30** | **6 of 21 strokes put the pen down LEFT of the previous stroke's pen-down** | *"'Desk Doodles' has no letter a hand writes out of order. **The trace is a trace, not a recording.**"* |
| **F31** | **The hero compresses 3.60×**, taking the shortest stroke to **66.9 ms** against the **100 ms** movement floor | The repo's gate already fails on this. ⚠️ R1 checked whether fixing F28 fixes it: **it does not** — stroke 15 is a real 173.6-unit stroke that also runs at 241 ms. |

### ✅ MY DETACHED FRAGMENT — CONFIRMED, MEASURED, AND GIVEN A TEST

**8 of 42 new-ink islands over 29 frames land detached. 3 are real defects**, separated from
legitimate lifts by a test that holds up and is worth keeping:

> **A lift grows FORWARD from where it lands. A defect gets filled in BEHIND it.**

Frames **4, 7 and 23**, filling backward by **53, 21 and 49 px**. In the pen's own coordinate the
front **retreats five times**, worst **6.9 %** of the word. **Frame 4 laid ink in two places 31.7 % of
the word apart** — which is the frame I looked at and called a 66 px void.

⚠️ **R1 chased `implicit-surface.ts:1215`'s `nearestIndex` vertex key first, wrote a positive control,
and it came back CLEAN on both keys. That hypothesis is NOT established** and it says so. The
short-stroke stubs are a sufficient cause on their own.

### 📚 WHAT IT OPENED, and one finding nobody expected

- **UCI Character Trajectories** — downloaded and measured. 2 858 real WACOM samples at 200 Hz.
  **Median 3 velocity peaks per single-pen-down character** at a 130 ms period; `m` gets **6.14**,
  `l` and `c` get 1.9. **The peak count tracks the letterform's structure and nobody had labelled it.**
- **Quick, Draw! raw** — 1 479 drawings. **37.4 % of elapsed time is pen-in-air.** Only **1.7 %** of
  gaps are under 100 ms — which is where the hard-coded 60 ms sits. The pen leaves the page at
  **0.485** of its own mean speed.
- 🔴 **"Writing with fountain pen", Wikimedia CC BY-SA 4.0 — all 392 frames extracted and LOOKED AT.**
  **The nib HIDES the newest ink. Its dark mass is 8.8× the area of all ink written so far.**
  *"You never see ink appear. You see it emerge from behind a moving object."* And: **after the pen
  leaves, the ink does not change — a wet-ink settle beat has no support here.**

### 🎯 THE TRIM-PATH ANSWER, which was the question that sharpens everything

> **A trim path is right on average and wrong at every instant.**

Averaged over a character, real handwriting is nearly constant speed: the mean time-to-length curve
across 2 858 samples is within **5.2 %** of a straight line. But each **individual** character is off
by a median **12.9 %** and up to **34.8 %**. The averaging cancels because each character's dwells
land somewhere different — **and averaging is exactly the operation a single easing curve performs.**

⚠️ **And it applies to us.** We do not use `stroke-dasharray`, but **`setDrawRange` over an arc-sorted
index buffer is a trim path in a different representation**, and it inherits the last two failures:
it cannot lift the pen, so a word becomes one continuous extrusion, and its order is **contour order,
not ductus.**

### 🎯 R1'S SINGLE RECOMMENDED CHANGE

**Drop every stroke shorter than one nib diameter, then replace the 60 ms constant with a three-tier
lift band — 90-150 ms within a letter, 150-300 between letters, 300-600 between words — drawn from
one per-instance seed.** The first is one filter and it removes **13.6 % of dead clock** plus the
mechanism that puts dots in clear air. The second is *"the largest change to how the beat feels per
line of diff."* ⚠️ **Do not add easing to the draw-in**, and §6 says why with numbers.

---

## 🔴🔴 F32 — FABRICATED PROVENANCE IN THE REFERENCE FILES, CAUGHT BY FILE SIZE

**R1 found this and it is the most serious process finding of the night.**

**Every `duc-*`, `tp-*`, `pen-*` `.txt` the gatherer lanes saved is ~2 KB and is the AGENT'S OWN
SUMMARY — filed under a header reading `SOURCE_URL` and `HTTP_OK: yes`.** One of them ends with the
agent's own opinion, set under the source's name.

**R1 caught it on file size**, re-fetched what it actually needed, wrote
`docs/research/write-on-references/_raw/_PROVENANCE-WARNING.txt`, and confirms **nothing in the
817-line doc is sourced to one of them.**

🔴 **A summary filed under `SOURCE_URL: <real url>` and `HTTP_OK: yes` is indistinguishable from the
source until somebody weighs the file.** That is worse than an uncited claim, because it survives
review: the next reader sees a URL, an HTTP status and plausible prose, and has no reason to doubt
any of it. ⚠️ **The 2 KB files stay on disk with the warning beside them, not deleted** — but nothing
may cite them.

**➜ The check is `ls -la`.** A fetched page is rarely 2 KB. **Weigh the file before trusting the header.**

---

## ✅ F22 — CLOSED `01effefd`. AND THE 25 CITATIONS NEVER ROTTED. THEY WERE WRONG ON ARRIVAL.

**Channel K reconciles: 101 gates, 101 entries, 0 red, CALIBRATED 34/34.** Was 28/29 red, 33/34.
The four K break-tests now read `0 pre-existing + 1` where they read `28 pre-existing + 1`.
**Census printed every run: 92 of 101 run a control bare, 7 partial, 2 none, both named.**

### 🔴 THE CAUSE, and it is not rot

**Not one of those 25 gates has a commit between the manifest's last commit and HEAD.**
`assert-motion-off`'s token has sat on **line 302 in every commit that ever contained the file**;
the manifest said **306**. The offsets cluster: **21 off by exactly 4**, 2 by 6, 1 by 2, and two far
off (`assert-citations` :412 against :926, `assert-hero-k7-intact` :411 against :580).

> **The 08-07 survey ran against working-tree gates that were not committed until 08-24. The
> citations were wrong the day they were written.**

⚠️ **This is the same root as the emergency this repo already closed.** A month of engine work lived
only in the working tree; the manifest was surveyed against that tree and then frozen against a
history that did not contain it. **"Rotted" implied decay over time and sent everyone looking at the
wrong axis.** Nothing decayed. Nothing was ever right.

**The three counts reconcile too, and none was wrong:** N1's **28** = 3+25 at `b43a445e`, before N6's
gate existed. N4's **29** = 3+26 in its frozen clone at `6eb76ae6`, a different commit line whose 26th
does not exist here. N7's **29** = 4+25, its fourth being `assert-nib-contrast.mjs`, **which lane N6
wrote to disk 67 seconds before N7 measured.**

### The split, honestly: 26 repaired · 3 ruled

**All 29 sites were OPENED, not pattern-matched.**

| | what | why it matters |
|---|---|---|
| **26** | cited where the control actually lives | 22 kept their ruling, kind and token. The 3 with no entry were read in full and ruled `control`: `assert-arm-took` (channel D, 8 fixtures, 5 known-bad, exits 1 on a miss) · `assert-harness-surface` (channel F, 5 publisher/consumer pairs both directions) · `assert-one-browser` (3 synthetic files whose known-bad is the real `headless: process.env.SL_HEADLESS === "1"` line **no grep could find**). |
| **1** | **re-POINTED, not re-cited** — `assert-flat-silhouette` | It cited `cmp.emdRel >= 3 * noise.emdRel`, which is **CONTROL A's threshold scaler**, and the gate's own header disowns it: *"a scaling factor is not a negative control."* Its real control is the bare run self-spawning on `--mutate=prior`. 🔴 **A mechanical re-cite — exactly what `--recite` would have done — would have bought a green certifying a non-control.** This one entry justifies the whole "open every site" rule. |
| **1** | **re-ruled `partial`** — `assert-pen-carve` | Three well-written known-bads, **every one behind `--mutate=`**, and `run-battery.mjs`'s `EXTRA_ARGS` is **empty**. So no sweep passes any of them. |
| **1** | **ruled `none`** — `assert-nib-contrast` (N6's new gate) | It **throws** (`TypeError` at `thin.degWorld`) before reaching any of its three arms, reproduced **3 of 3**. `none` chosen deliberately over `partial`: **`none` prints by name every sweep; `partial` only gets counted.** |

### 🔴 WHAT THE MUTATION PROVED, AND THE INVERSE IS THE FINDING

Restored byte-for-byte to sha `d879ac8f`. Deleting `assert-flat-silhouette`'s control block and
de-coupling its exit — **an edit that still parses, so a realistic one** — turns the real gate red on
exactly that entry: `FAIL K accepts the real one *** 1 unexpected: assert-flat-silhouette.mjs rotted-line ***`.

**Now the inverse.** Leave the cited text in place and set `const controlOk = true`, so the control
can no longer say no: **K stays green.**

> 🔴 **Nothing in this repo catches a control arm disabled in place while its comment survives.**

N7 states plainly that this is K's stated scope and **refuses to soften it**. **So a green manifest
means a control is CITED, never that it can still say no.** That is the honest reading of tonight's
"0 red", and it is why N4's "zero of 100 shown able to fail" does not fully close even now.

### ✅ CITING BY TOKEN IS FEASIBLE — measured, not guessed

**89 of 96 tokens match exactly one line in their gate. 7 match more than one. 0 match none.**
Token-primary lookup (find the token, require one hit, treat `line` as advisory) **would have
prevented all 25 outright.** It is a change to `reconcileControls`, not to the manifest, **so N7
reported it rather than making it.** Correct call, and it is now **F23(a)**.

### ⚠️ THE DENOMINATOR, which N7 volunteered

> **"I read 29 of 101 entries. The other 72 pass K3, which proves a citation sits on its line, not
> that the line is a control."**

**`assert-flat-silhouette` is the proof that those are different claims** — it passed K3 for weeks
while citing a threshold scaler. **72 entries are unverified in that stronger sense.**

| # | still open | note |
|---|---|---|
| **F23a** | **Cite by token, not line** | 89/96 unique. Prevents the class rather than clearing it once. |
| **F23b** | **The meta-gate sees 101 gates; `run-battery`'s `discover()` sees 102** | The gap is `docs/storyboard/tools/assert-moment.mjs` — **run by the batteries, seen by no integrity channel.** ✅ Confirms N4's F26 with a number. The repo's own *"one table, three readers"* rule points at the fix: **import `discover()` rather than restating the scope.** |
| **F23c** | **Three sound instruments are invisible to K by construction** | Discovery is `startsWith("assert-")` over a **flat** readdir of `scripts/verify` (`:1877`, `:2011`). `_probe-port-resolver` and `sweep-browsers` fail the prefix; `lib/frame-guard` fails prefix **and** directory. Wiring them is a rename or a new rule, and neither is a lane's call. |
| **F27b** | **`gate-integrity/report.json` is fresh now but its KIND is unrecorded** | N7's runs regenerated it (03:17, 452 KB), left uncommitted. **The deeper row: a `--static` run writes the same filename with no channel C or D content, and nothing outside says which kind of run produced it.** |

---

# 🔴🔴🔴 THE ANSWER F22 UNLOCKED — "CAN EACH GATE FAIL?" IS NOW ANSWERABLE, AND ABOUT HALF CANNOT

**`[MEASURED HERE]` by the controller, immediately after N7 landed `01effefd`.**

Before tonight `assert-gate-integrity` **refused to sweep**. It now says:

```
CALIBRATED — 34/34 across channels A-K, every one of them a known-answer pair:
each rule has a case it must REJECT and a case it must ACCEPT. Its verdicts below are usable.
```

**"Its verdicts below are usable" is the sentence this whole lane bought.** And the verdict is:

```
5N FAILURE(S) across channels A-J — scripts named assert-* that cannot report a failure,
or cannot report the failure they exist for.
```

### ⚠️ THE COUNT IS NOT STABLE, AND I AM REPORTING THAT RATHER THAN PICKING A NUMBER

**Three consecutive runs inside ten minutes: 53, then 52, then 51.** Monotonically decreasing, which
is not noise. **Lane N6 was still committing throughout**, and several of the failures are channel F
staleness judgements that read mtimes. **So the honest statement is "about 52 of 101, and the
instrument is not yet deterministic."** ➜ **F33: re-run gate-integrity on a quiet tree and record a
number that holds twice.** Anyone quoting a single figure from tonight is quoting a moving one.

### The failure shapes, from the rows themselves

| shape | example | what it means |
|---|---|---|
| **`bare run exits 1`** | `assert-timing` · `assert-stack` · `assert-seam` · `assert-screen-layers` · `assert-pentip-specks` · `assert-stack-anim` | The gate **is already red on a bare invocation.** It cannot report a NEW failure because it never gets to a clean baseline. |
| **`capture predates its subject by N days`** (channel F) | `assert-timing-frames --label=after` · `assert-taper-envelope --label=run` · `assert-screen-layers --label=final` · `assert-penfield-offthread` | **A bare run grades a build that no longer exists**, and several *"cannot recapture."* ✅ This is N4's provenance bucket, confirmed by a second instrument. |
| **`N judgement(s) no sweep reaches`** | `assert-tsc-baseline --no-http` · `assert-one-knob --record` · `assert-hero-dead-channels --control=` (6 judgements at `:189 :368 :373`) | **The known-bad exists, is correct, and is behind a flag no runner passes.** Same shape as N7's `assert-pen-carve` ruling and as explainer 36's *"written, wired, given a required-red table, and put behind a flag nothing types."* |

### 🔴 WHAT THIS DOES TO TONIGHT'S OTHER HEADLINE

N4 measured **88 of 100 gates ran clean** and said plainly *"zero of 100 were shown able to fail."*
**That was the honest phrasing and it is now quantified:** roughly **half of them cannot report the
failure they exist for** in the state a sweep actually runs them.

⚠️ **And N7's inverse mutation caps even this.** A control disabled in place, with its comment left
standing, **keeps channel K green** — so `52` is a floor, not a ceiling. **The gates that merely
*cite* a control they can no longer use are not in this count.**

> **This is the row the repo has been circling for a month.** `DISPATCH.md` §2.6 says *"ten
> instruments in this repo have reported green while measuring nothing."* **Ten was optimistic by
> about a factor of five, and nobody could see it because the instrument that counts them would not
> start.**

---

## 👁 CONTROLLER'S OWN EYE ON THE NIB — and I am not going to oversell it

**`[MEASURED HERE]`** I cropped `before/free-stroke/frames/045.png` and `after/.../045.png` to an
**identical** box computed from the union of both bounding boxes (`528,420 885×259`) and looked at
both. Bounding boxes agree to **2 px** — before `x 548-1371`, after `x 548-1373`, `y 440-639` both —
so the word did not move, which is what N6's rotation row asserts and it holds by eye.

**What I see:** the `after` is **slightly** thinner at the `D`'s stem top and through the diagonals,
and the `e`'s counter is **slightly** more open. **That is the whole visible difference at 1.8 : 1.**

🔴 **It is a real change and it is a small one, and the number says the same thing.** Contrast went
**1.203 : 1 → 1.784 : 1**. `stroke-width-models.md` asked for **5 : 1 to 10 : 1**. **We are at a third
of the bottom of the range the research called the point of the exercise.**

**Do not read the mechanism landing as the problem being solved.** The monoline is gone as an
*architecture* — width now depends on direction, proved by a known-bad the round pen fails — but the
mark he called *"ass"* has moved a little, not a lot.

### 🔴 THE TENSION THIS EXPOSES, and it is HIS to resolve

N6 measured both of the doc's own prescriptions and **both lose on this hand**:

| the doc says | N6 measured |
|---|---|
| aspect **5 : 1 to 10 : 1** | **`aspect 5` retains 68.1 % of enclosed area, 3 counters against 7** — it **closes the letters** |
| angle **0°** (Johnston 1906) | **`nibAngleDeg: 0`'s worst counter keeps 1.1 %** — 1968 → 21 texels, and 87.5 % area against 30°'s 94.5 % |

**So the contrast that reads and the contrast that keeps the word legible are pulling apart**, and
1.8 : 1 at 30° is where N6 landed between them. **That trade is a taste call on a legibility floor,
which makes it exactly his** — §2.8, shipped as dials with a recommendation.

### 🎯 THE HYPOTHESIS THAT MAY DISSOLVE THE TENSION — for whoever takes this next

**R1 measured that 9 of 22 traced strokes are SHORTER THAN THE NIB IS WIDE.** A stub swept by any nib
renders as the nib's own footprint. **A bigger nib makes a bigger blob, and blobs are what fill
counters.**

➜ **So the counter closure at aspect 5 may be caused by the stubs rather than by the aspect.**
**Test R1's filter first — drop every stroke shorter than one nib diameter — and THEN re-run
`assert-nib-contrast` at aspect 5.** If the counters survive, the aspect ceiling was never the nib's,
and the research doc's 5 : 1 becomes reachable.

**That is the single highest-value experiment left in this project, it is two measurements, and
neither lane could run it because each held only half of the finding.**

---

## ✅ N6 · THE NIB — LANDED, `65028b3e` → `ed170b1f`, seven commits. AND IT CORRECTED ME TWICE.

### ⚠️ CORRECTION 1 — MY DIAGNOSIS WAS HALF WRONG. THE 2D HALF ALREADY HAD THE NIB.

I wrote that *"the 2D pass writes decent letterforms and the 3D pass turns them into tubes."* The
observation was right and **the reason I gave was wrong.** `lib/flat-ink.ts` is **already a full
broad-nib implementation** — `nibHalfWidth`, `penHalfWidth`, `PEN_NIB_DEFAULT` at **aspect 1.8 @ 30°**,
a Minkowski stamp union. **The flat letterforms are not decent by luck. They are a shipped nib.**

🔴 **So this is the FIFTH time tonight: the answer was already on disk. The nib existed in 2D and
nobody carried it to the solid.** The solid was the only monoline in the beat.

**And the brief's line numbers had drifted, again:** `flat-ink.ts:104-106` → `lineWidth` at **`:433`,
`:531`** · Extrude's constant halfWidth `:1400-1404` → **`:2017-2429`** · and the Z pre-scale the whole
approach generalises **is not in `geometry-engines.ts` at all any more** — it moved to
`lib/implicit-surface.ts:1606`, `applyImplicitZAspect`.

### ⚠️ CORRECTION 2 — I CHALLENGED THE 30° TWICE AND THE DOC SAYS 30°.

I told N6 that `nibAngleDeg: 30` contradicted its spec, citing Johnston's 0°. **It does not.**
`stroke-width-models.md` §1.3 quotes Johnston for the **historical hand**, and its own **ranked item 1
says: _"Default to 30° for the logo … but the 0° preset is the historically-primary one and should be
one click away."_** N6 shipped 30° as the default with 0° one click away. **It followed the doc; I
misread it and pushed twice on a point that was already settled.**

**It tested 0° anyway and made it a known-bad:** the `o` at x≈876 goes **1968 → 21 texels**, and the
word keeps 87.5 % of its enclosed area against 30°'s 94.5 %.

### 🎯 AND THE ASPECT: IT RENDERED WHAT THE DOC ADMITS IT NEVER DID

**`stroke-width-models.md` §7, its own words: _"No frames. This is a research document and nothing in
it has been rendered."_** Its 5:1 ranking came off a **1-D direction census**. N6 rendered the sweep:
at **4.0** the `e`, `s` and `oo` are merging; at **5.0** *"Doodles reads as one black mass"* — 3
counters of 7, 68 % of the enclosed area, ink **+32 %**; **6.7 is illegible.**
`sweep/SHEET-aspect-full.png`.

**And the deciding argument is not the sweep, it is coherence:** 1.8 matches `flat-ink.ts`'s authored
pick, and **the two halves of the beat must be one pen.** The flat nib pins `a = R`, so the solid at
`a = 1.342 R` **contains it at every direction with 34 % of margin** — which is what keeps the carve a
fragment `discard`.

### The build

The affine change of variables, §4.3 exactly. Centreline pre-transformed by **A⁻¹ before resampling**
(§4.4 caveat 3), the round tube swept unchanged, vertices mapped back by **A**, normals by **A⁻ᵀ**.
**No new geometry path**; the implicit field and the ring loft both get it, and **preview == export
byte-for-byte.**

⭐ **Axes are `a = weight·√aspect`, `b = weight/√aspect` — determinant 1.** So marching cubes costs the
same cells, and **√1.8 = 1.342 IS §1.4's ×1.37 weight restore, arrived at from the determinant rather
than fitted.**

**Two defects it shipped and then caught BY MEASUREMENT, not by reading its own diff:**
1. **`A²` rotated the whole logo 12°** — a boolean guard cannot separate implicit-defer's four paths.
   Guard is now the position-array object. Evidence kept at `after-doubled/`.
2. **The draw-in's arc table was in field space** — `assert-implicit-reveal` went 0.58 % → **5.03 % of
   word width**, the pen's nose off the ink it is drawing. `capArc` maps each segment through `A`
   first: back to **0.66 %**.

### The gate — `assert-nib-contrast.mjs`, 13/13, exit 0, five known-bads

**With `INFLATE_NIB_ASPECT_DEFAULT` forced to 1.0 the gate exits 1.** Two silent rasteriser traps
found on the way: one `beginPath` of 76 000 triangles **fills to zero ink with no throw**, and a
closed mesh projected to 2D **cancels itself to nothing under nonzero** unless every triangle is
flipped to one handedness.

### 🔴 THE OPEN ROWS, and the first one is the one that matters most tonight

| # | row | note |
|---|---|---|
| **F34** | 🔴 **`lib/dd-engine/` IS STILL A MONOLINE. DESK DOODLES DID NOT GET THE FIX.** | Filmed both families: `desk-doodles` returns **byte-identical** numbers before and after — 28 131 ink, the same 7 counters — **because `adapter.ts` never reads `inflateParams`.** Free Stroke moved. Desk Doodles did not. ⚠️ **He named Desk Doodles by name**: *"the desk doodles like its all kind of crappy and the way it writes in is ass still."* **The family he complained about is the one still on the round pen.** |
| **F35** | 🟡 **The counter-opening trade is REACHABLE and was not taken** | **aspect 2.4 at `nibWeight 0.645` → contrast 2.379, 7 counters, +26 % counter area.** Costs **27 % of the word's ink weight** and **breaks the flat ⊂ solid containment**, so the pen field would stop deciding the flat mark. **His call, not a lane's.** |
| **F36** | 🟡 **`assert-seam` is pinned to `nibAspect: 1`, with the reason written in** | Three rows went red and **were not a defect**: every row compares a shape against itself around its circumference, so it **assumes an isotropic pen**. Left red, *"a real seam bulge would have become indistinguishable from the pen."* Correct call; the gate needs an anisotropic form. |

### The blob — still there, different shape, exactly as R1 predicted

`AB-entry-tick-solid.png`, same crop, same instant: ink **4275 → 4152 px (−2.9 %)**, still one
connected component. **What changed: the two entry marks read as two angled ticks instead of one fused
lozenge, and their ends are cut at the nib angle rather than domed.** *"A nib stamps its own footprint
on a path shorter than itself; it cannot remove one."* ✅ **R1's stub filter remains the fix.**

### What it saw when it looked, and it is the right register

> *"Rows 1-2, the write-in, are identical — that register was already right. Row 3, the settled solid:
> on the left every stroke is one diameter with hemispherical ends; on the right the `D` stem is heavy
> and its bowl thins as it turns over the top, the `k`'s two diagonals stop being the same stroke, the
> `l`s are thick with cut tops instead of domes, the `o`s are thick on one axis and thin on the other,
> and the `e`'s eye is open where it was a pinhole."*
>
> **"It is no longer tubing. It is not yet a calligraphic hand either, and it should not be: at
> 1.8 : 1 it reads as his marker held at an angle, which is the mark the logo is."**

**tsc exactly 6. Battery 40/48 model green, up from 36.** The 8 reds are 6 PROVENANCE and 2
fusion-combo "no capture", **three confirmed red with the pre-nib file, so they are not its.**

---

## ✅ N8 · FINISH THE MARK — LANDED `52ed28a4` → `239414b3`. THE BLOB IS GONE. MY HYPOTHESIS IS DEAD.

### ✅ F34 — DESK DOODLES MOVED, AND IT PROVED THE BUG FIRST

**`[MEASURED HERE]`** It reproduced F34 before fixing it: `md5` of `before/desk-doodles/frames/045.png`
and `after/…/045.png` was **`18975d8dff8879e7de63b2f4394e9c76` in BOTH.** Byte-identical. **Its own
build reads `42e21c60…`.**

`lib/dd-engine/adapter.ts` now routes through the exported `inflateResolveNib` /
`inflateNibToField` / `inflateApplyNibToGeometry`. **Inflate only — the same scope Free Stroke's nib
has**, not a wider change smuggled in.

| | contrast | counters | ink | axis |
|---|---|---|---|---|
| **desk-doodles** round pen | 1.163 : 1 | — | 1.000× | 0.104° |
| **desk-doodles** nib | **1.780 → 1.825** after the stub filter | 99.3 % | 1.042× | −0.492° |
| **free-stroke** | 1.784 → **1.804** | 94.7 % | 1.038× | 0.013° |

### ✅ F28 — THE NINE STUBS ARE GONE, AND THE CLOCK RECONCILES TO THE MILLISECOND

Dropped **9 of 22** (strokes 1, 2, 5, 6, 8, 11, 17, 19, 21). **Threshold is `opts.nibDiameter`
(22.580), derived, never written down.** ⭐ **Longest dropped 0.693 nib, shortest kept 3.056 nib — a
4.41× gap**, which is why the nib's anisotropy never has to enter the filter.

**"Drop" means the stroke vanishes and its time goes with it.** Ink **−2.18 %** of travel. Record
**16.805 s → 13.977 s, −2.829 s = 16.8 %** — ⭐ **R1's 2 289 ms plus nine 60 ms lifts, to the
millisecond.** Air 1.260 → 0.720 s. Strokes sharing 241.1 ms: **9 → 1**.

**Redistributing the time was considered and rejected, with a reason:** *"it is dead clock, and
handing it to the survivors slows the pen to preserve a duration the taps invented."*

⚠️ It lives in `stampPenClock` on the **raw** polylines, because `endpoint: "protrude"` turns a
4.9-unit stub into a **46.7-unit stroke** before anything downstream sees it. And `buildFontStrokes`
**must not** opt in: its `FONT_LETTER_MAP.of` is index-parallel, so a filter there **flips an `i`'s
dot off its stem.**

### 🔴 MY HYPOTHESIS IS DEAD, AND IT WAS KILLED PROPERLY

I proposed that the counter closure at aspect 5 was caused by the stubs, not the aspect, and called
it *"the single highest-value experiment left."* **It is wrong.**

**Free stroke at aspect 5: before the filter 3 counters / 68 088 texels. After the filter 3 counters /
68 948.** Nine strokes left the word and **the closure did not move.** N8 opened
`ASPECT-{before,after}-filter-fs.png` and at 5 *"Doodles is one black mass in each, `oo` filled solid,
`e` filled, `s` a slab."*

> **The counter closure is the aspect. The aspect ceiling was the nib's all along.**

**But the sweep found a real one anyway:** post-filter, **aspect 2.0 is newly reachable on free
stroke** (92.3 % area, worst counter 34.7 %) and **is NOT on desk-doodles** (worst counter 21.5 %,
under the 25 % floor). **Default left at 1.8. → F35 now has a second, measured operating point.**

### 🎯 THE ALMOND BLOB IS GONE

**`AB-stubs-Dstem.png` at 5×:** *"a fat black almond sits across the top of the `D`'s stem in the
nib-only frame and simply is not there after the filter. Same on free stroke."*

**That is the artifact he has been describing since 2026-08-04 as *"the artofacting when drawing and
letter pieces missing."* It was nine accidental taps, each swept into a lozenge by a pen wider than
the tap was long.**

### 🔴 TWO SILENT INSTRUMENT DEFECTS IN LAST NIGHT'S OWN GATE

**`_nib-measure.mjs` would have passed a ROUND PEN on desk-doodles.**
- `radiusXY` and the fit's semi-axes came from `INFLATE_DEBUG`, **which desk-doodles never writes** —
  the fit returned **0° for every DD arm.**
- The census over **whole strokes** let DD's `sin(πu)^0.8` profile read **1.676 : 1 on a round pen**,
  **above the 1.56 floor.**

Restricted to arc band **0.2-0.8**: DD round drops to **1.163**, and ⭐ **free stroke's two numbers do
not move at all** (1.203 / 1.784) — which is the control proving the restriction is not just a
knob-turn.

⚠️ **And N6's known-bad pairing was a fact about ONE ENGINE.** `johnston` keeps **1.1 %** of its worst
counter on free-stroke and **70.0 %** on desk-doodles, which fuses nothing. **Exempting the row would
have left `desk-doodles/counterWorst` unable to say no.** Both gates now assert coverage **per row,
per family**, and print the matrix.

### ✅ THE BEAT CONSTANTS MOVED, AND THE PASTE NOW HAS A GATE

`letterCount 10 → 11`, `letterSilentAfter 2 → 3`. Two of the nine taps were **bridging the `s` to the
`k`**; with them gone `assignLetters` returns `[0,1,2,3,3,4,5,6,7,8,9,10,10]` — **every letter of
"DeskDoodles" its own piece.**

**Paste checked, not assumed:** `motion.mjs` carries no letter constants, **32 exports matched, 56
leaf values agree at the paste's own precision.** And **it built the gate** (5/5, exit 0) that the
README had been defending with a sentence. ⭐ **It earned its keep on its first run:** `EMERGE.sec`
did not resolve, because the paste flattens the clip into the turn while the source keeps length in
`beats.emerge`. **An unmatched export is a red row, never a skip.**

### 🔴 OPEN REDS — and N8 stopped rather than retune the beat

| # | row | note |
|---|---|---|
| **F37** | 🔴 **The 11th letter does not fit the cascade clip** | `assert-hero-options` **35/39**. `cascadeSec` **5.800 s into a 5.333 s / 160 fr `emerge` clip**; *"2 DIFFERENT PICTURES of one event across 10 letters"*; worst single-frame step **66.8°** (letter 10) against the turn's 38.0°, bar 43.7°. **Three coupled motion constants**, and `letterPairFrom` is the board's own sanctioned lever, sitting at −1. 🔴 **N8 STOPPED rather than retune the beat — correct, §0.7.** ⚠️ **`dropSubNibStubs: false` at `page.tsx` reverts the whole thing in one word.** |
| **F38** | 🟡 **`assert-drawin-2d-parity` clock row** | 1.81e-3 against a 1.30e-3 tolerance = **5.57 px on a 3075.8 px path**, at **one** playhead of 19 (t = 0.60); the other three read 5.5e-6 to 2.8e-5 and the controls still separate at 30×. **It tested the obvious explanation — an ill-conditioned inversion where the pen retraces — and REJECTED it** (new-ink rate at 0.634 is 0.665, no lower than 0.505 at t = 0.40). **Cause not found, and it says so. Tolerance untouched.** |
| **F39** | 🔴🔴 **`assert-hero-word-legible` DELETES 33 COMMITTED PNGs ON EVERY FAILED RUN** | Each failed run **`rmSync`s** the word-ladder captures **before** writing. **Explainer 37's shape, still live.** N8 restored them twice. ⚠️ **Destroying evidence is strictly worse than writing bad evidence: a wrong frame can be re-graded, a deleted one cannot.** Not N8's — identical timeout with the filter off, two runs. |
| **F40** | 🟡 **`assert-drawin-pentip` grades a 25-day-stale capture and has no freshness guard** | Its bare invocation reads `docs/verification/pentip/run`, whose `meta.json` is dated **August 3**. **The red predates tonight by weeks; the stub filter only tipped it over.** |

### 🎯 JOB 4 NOT ATTEMPTED, AND THE REASON IS A MEASUREMENT

**R1's item 2 (a real lift band) and item 4 (the 100 ms movement floor) pull AGAINST each other on a
fixed 4.667 s draw beat, and R1's §7 does not say so.** Longer gaps push the shortest stroke
**further under** the floor, not closer:

| mean gap | record | compression | shortest on screen |
|---|---|---|---|
| **60 ms (shipped)** | 13.977 s | 2.99× | **80.5 ms** |
| ~120 ms | 14.697 s | 3.15× | 76.6 ms |
| ~200 ms | 15.657 s | 3.35× | 71.9 ms |
| ~350 ms | 17.457 s | 3.74× | 64.4 ms |

**The draw beat would have to run 6.494 s for the band at 200 ms to clear the floor, against the
shipped 4.667 s.** That is a second timing decision on a beat that already has one open. **Both are
his.**

### 👁 N8'S OWN EYE

> *"**It is not tubing.** On both families the `oo` are lozenges with angled slots for counters instead
> of rings, the `ll` are blades cut at the pen angle instead of domed tubes, the `D` bowl thins as it
> turns over the shoulder, and the stem is a wedge. At 1.8 : 1 it reads as his marker held at an
> angle — not a calligraphic hand, and it should not be."*

**And the one thing that got worse, which it named itself:** ink is up **1.042×**, and at 4× the `D`
and the `o` of "Doodles" **now touch where the round pen left clear air** — three new 62-127 px
counters in the film census. At the gate's 400-texel floor it is 8 counters before and 8 after with
99.3 % of the area kept, and **invisible at 1×**. **Worth watching if the weight dial goes up.**

---

## 🔴 F40 SPLIT INTO TWO — `assert-drawin-pentip`, killed at 72 minutes

**N8 killed it by exact pid** (`kill 57114`, exited on SIGTERM, no strays, **no `pkill -f`**) and then
did the thing that turns a hang into a finding: **it sampled the process.**

**It was NOT deadlocked.** A 4-second `sample` put the whole stack in a JIT'd JS frame calling
**`Builtins_MathHypot`** — a distance loop, **doing real work, at 99 % CPU for 72 minutes**, with no
output past its first `reading …` line.

### ⭐ THE DISPROPORTION IS THE FINDING, and it is the opposite of what anyone would guess

| capture | dated | samples/arm | arms | gate runtime |
|---|---|---|---|---|
| **`run`** — what the bare invocation reads | **2026-08-03** | **201** | 4 | ~1-3 min, **completes** |
| **`gate`** — captured fresh tonight | 2026-08-28 05:28 | **33** | 4 | **> 72 min, never completed** |

**One eighth of the playheads. Two orders of magnitude more time.** N8 did not find the cause **and
refused to claim one**, which is the correct ending.

| # | row | note |
|---|---|---|
| **F40** | 🔴 **The gate has NO FRESHNESS GUARD and has been grading August-3 frames for weeks** | `docs/verification/pentip/run/meta.json` is dated **2026-08-03 — 25 days old**, and `grep` finds **no freshness check** in `assert-drawin-pentip.mjs`. ⚠️ **The stub filter TIPPED an already-stale comparison over; it did not create it.** ⭐ **And the fix already exists on disk: `render-freshness.mjs` and `_capture-freshness.mjs` were built for exactly this.** **That is the SIXTH time tonight the answer was already here.** |
| **F41** | 🔴 **On a FRESH 33-sample capture the gate does not terminate in 72 minutes** | Sampled to a `Math.hypot` loop at 99 % CPU. **Cause not found and not guessed.** |

🔴 **So the honest status is: `assert-drawin-pentip` HAS NO VERDICT ON THE CURRENT WORD, and cannot
get one until F41 is fixed.** Its green on the stale capture was never about tonight's mark. **That is
a third distinct way a gate can be worthless while looking fine — not vacuous, not uncalibrated, but
grading a build that no longer exists.**

### ✅ Final state, re-verified by N8 after the kill

`assert-nib-contrast` **exit 0** · `assert-stub-filter` **exit 0** · `assert-motion-paste` **exit 0** ·
tsc **exactly 6** · **0 deleted files in the tree** — it restored the 33 word-ladder PNGs that
`assert-hero-word-legible` wipes on every failed run, **twice**, and they are back.

⭐ **And the shared-index fix held under real load:** five path-named commits from N8 while the
controller committed `6c234f18` on top, **and neither took the other's work.** F20's remedy is proven.

---

# 🌙 WAVE 2 — 2026-08-28, AFTER THE FIRST EIGHT LANDED

**He said: _"ur in auto mode keep running."_ I stopped when the lanes landed. That was wrong — the
night is the deliverable, not the wave.** Rows first, then dispatch.

**What the first eight exposed and nobody has taken.** These are not new discoveries, they are the
structural rows the battery and the manifest work uncovered, each with its evidence already measured.

| # | lane | owns | job |
|---|---|---|---|
| **N9** | **EVIDENCE SAFETY** | `assert-hero-word-legible.mjs` · `assert-drawin-pentip.mjs` · `_probe-word-ladder.mjs` | **F39** a gate that `rmSync`s 33 COMMITTED PNGs every failed run · **F40** no freshness guard when `render-freshness.mjs` already exists · **F41** 72 min on a 33-sample capture, sampled to a `Math.hypot` loop |
| **N10** | **THE ROT CLASS** | `assert-gate-integrity.mjs` · `scripts/verify/lib/control-manifest.json` | **F23a** cite by TOKEN not line — 89 of 96 tokens are unique, so this prevents the class instead of clearing it once · **F23b** the meta-gate sees 101 gates where `run-battery`'s `discover()` sees 102 · **F23c** three sound instruments invisible to K by construction |
| **N11** | **THE CRASH ROW** | `scripts/verify/run-battery.mjs` · `run-browser-battery.mjs` · a new shared helper | **F25** — **98 of 100 gates turn a crash into a non-zero exit with NO FAIL ROW.** Three did it tonight. Every scoreboard that counts rows sees the passes printed before the crash and no failure. |

⚠️ **N10 and N11 both touch how gates are discovered and reported. They are given disjoint files and
told to hand each other's territory back rather than reach into it.**

---

## 👁 CONTROLLER VERIFIED THE DESK DOODLES RESULT — including N8's own reported regression

**`[MEASURED HERE]`** I opened `docs/verification/mark-2026-08-28/AB-dd-esk-zoom.png` — the `k D o`
cluster at 4×, round pen on top, nib below. **This is the family he named**, so relaying N8's numbers
without looking would have been the wrong call.

**What is better, and it is visible without being told where to look:**
- **The `o`'s counter is genuinely OPEN.** On the round pen it is a nearly-filled slot; on the nib
  there is clear white inside it.
- **The `D`'s stem is a wedge**, thinner and directional, instead of a constant tube.
- **The `k`'s diagonals taper** and read as two separate strokes rather than one extrusion.

🟡 **And N8's self-reported regression is REAL and I can see it: the `D` and the `o` now TOUCH where
the round pen left clear air.** It named this itself — *"ink is up 1.042×, and at 4× the `D` and the
`o` of Doodles now touch"* — and it is the honest kind of finding to volunteer, because nothing in its
gate would have caught it: at the 400-texel floor it is **8 counters before and 8 after with 99.3 % of
the area kept.**

**N8 says it is invisible at 1×.** That is plausible and I have not checked it at 1×. **➜ F42: worth
his eye, and worth watching if the weight dial ever goes up.** A `Do` that touches is not wrong in a
handwritten mark — letters touch in real writing — but it was not there before and he did not ask
for it.

---

## 🔵 N12 · THE CLIP THAT WAS ALWAYS DERIVED — dispatched, row written FIRST this time

**`[MEASURED HERE]` by the controller.** F37 is not a taste call. **It is the seventh materialised-
derivation bug of the night.**

`lib/hero-motion.ts:1919` is **`emerge: 160 / 30`** — a hard-coded literal inside a static clips
object. And `cascadeSec(p)` at **`:2539`** computes the very same quantity:
`slotStartSec(p, maxSlot) + letterBeatSec`.

**The file's own comment at `:1883` says outright that 160 is that function's OUTPUT, not a choice:**

> *"`emerge` THE CASCADE, 160 fr. **Not a number picked to fit:** `cascadeSec` computes
> `letterLeadSec + maxSlot · letterBeatSec` from the board's own two intervals and **returns exactly
> 5.333 s / 160 fr.** `assert-hero-options.mjs` asserts every letter's flip ENDS inside this clip
> rather than trusting it — **a retime that pushed the last flip into the hold would otherwise
> silently steal the money frame.**"*

🔴 **AND THE COMMENT RECORDS THAT THIS EXACT DEFECT ALREADY HAPPENED ONCE:**

> *"⚠ IT WAS 131 fr, AND THAT CLIP WAS WRONG IN BOTH DIRECTIONS AT ONCE … 131 frames held a 103-frame
> cascade and left **28 frames of dead air** … Against the cascade the word really has — ten pieces —
> the same 131 frames were **29 SHORT** and the last two flips would have run inside the hold.
> **One number, wrong twice, because it was authored against a letter count nobody had rendered.**"*

**It is now wrong a third time, for the third time for the same reason.** N8's stub filter took
`letterCount` 10 → 11 (two taps were bridging the `s` to the `k`), `cascadeSec` moved to **5.800 s**,
and the literal stayed at **5.333 s**. `assert-hero-options` reads **35/39**.

⚠️ **So the beat is SHIPPING BROKEN right now** — `dropSubNibStubs: true` at
`app/desk-doodles/page.tsx:169` — and by the file's own words the last flips run inside the hold and
steal the money frame. **Leaving it is not the neutral option.**

**Two ways out, and the choice is his, but only one keeps what he asked for:**
| option | cost |
|---|---|
| `dropSubNibStubs: false`, one word | **the almond blob comes back** — the artifact he has described since 08-04 |
| derive the clip | **the beat gets ~14 frames longer** at 11 letters |

**N12 is dispatched to derive it, as a no-op at `letterCount` 10**, so the change is provably the
re-derivation and not a retune. ⚠️ **It may NOT touch any other beat constant** — `letterBeatSec`,
`letterLeadSec` and `letterPairFrom` are relationships §0.7 reserves for Sebs.

---

## ✅ N9 · EVIDENCE SAFETY — LANDED `3a6ebb0a`. THE HANG WAS AN INFINITE LOOP, NOT SLOWNESS.

### ✅ F39 — the wipe, fixed and controlled BOTH ways

`_probe-word-ladder.mjs` now stages into `.<label>.staging` and **swaps onto the stored set only once
every frame exists**. ⭐ **Swap is on COMPLETION, not on the pass flag** — *"a finished capture that
photographed a defect is evidence; only an incomplete one is worthless."* It weighed a
git-tracked-file guard and **rejected it**: that still leaves a half-written set behind when the flag
is passed.

**The control, same deliberate kill 12 s in, exact pid, no `pkill`:**

| | files on disk | git deleted |
|---|---|---|
| **known-bad (HEAD)** | 41 → **2** | **39** |
| **fixed** | 41 → **41** | **0** |

**And it proved the success path too**, so the guard is not just refusing to write: a complete run
swapped 17 files in and removed staging. ⭐ **Then the real gate ran end to end and died on its own
first try** — `waitForFunction: Timeout 120000ms`, the dev-server flakiness N1 measured — **with 0
files destroyed.** A live proof, not a synthetic one.

### 🔴 F41 — THE CAUSE, AND IT IS A NON-TERMINATING LOOP

**Not slowness.** `wG = inkN / (2·totalPx)`. The `gate` capture frames the mark at **half the height**,
so the ruler fit misses — **0.5 % of the path on ink against `run`'s 100 %.** The `mis-scaled-fit`
known-bad arm then rebuilds that ruler at `scaleMul: 0.8`, pushing the path clear of the mark, so
**`inkN` = 0, `wG` = 0**, and the curvature loop becomes:

```
for (a = d; a <= d; a += 0)
```

**An infinite loop spinning in `Math.hypot`.** It reproduced N8's exact `Builtins_MathHypot` sample
and pinned it to **playhead 1 of the sixth of seven arms.**

⭐ **"The sample count was a coincidence; it would hang at any size."** `run` never hits it because its
fit is perfect at every scale — **the gate had never been run on a capture it could not fit.**

**Guarded on the ruler, not the loop.** And two more guards fell out of actually running it, **both
F25's shape**: an arm with no playheads **crashed the print block on `null.toFixed()`** — non-zero
exit, no FAIL row — and 🔴 **a known-bad arm that measured NOTHING was PASSING its own row**, because
a null score compares false against every threshold.

| | HEAD | fixed |
|---|---|---|
| the capture that hung | **>72 min, never completed** | **2 s, exit 1, 23 rows** |
| good capture (regression) | 14 s, 43 rows, 3 failures | 14 s, **44 rows**, 3 failures |

**The good-capture run is HEAD's byte for byte plus F40's one row**, all 14 known-bad rows still fire
on real numbers, and its 3 reds are identical under HEAD.

### ✅ F40 — it used the module that already existed

**`_capture-freshness.mjs`**, its `newestUnder` / `newestCapture` primitives, **the same way
`assert-pentip-specks.mjs` uses them and for its recorded reason**: `captureFreshness()` itself would
certify this gate's own `pentip.json` written into the capture dir. **Nothing new written.** Bare
invocation now goes red in a second — **`STALE BY 590.6h`** — **and passes on a fresh capture**, so it
is not a row that can only fail.

---

## 🔴🔴 F43 — THE WIPE IS IN 53 SCRIPTS. ONE IS FIXED. FIFTY-TWO REMAIN.

**`[MEASURED HERE]`** with the denominator stated honestly in
`docs/verification/evidence-2026-08-28/f39-the-class-not-just-the-instance.md` — **counts are tracked
files in the reachable subtree, not per-run deletions.**

**Biggest reach:** `film-hero-beat.mjs` → `hero-beat-film`, **15 302** · `_probe-pentip-shape/sweep` →
`pentip`, **8 176** · `assert-hero-reduced-motion` + `verify-hero-transition` → `hero-transition`,
**5 887** · `lib/frame-guard.mjs` + `verify-screen-layers` → `screen-layers`, **3 818**.

### 🔴 AND THE ONE THAT DESERVES ITS OWN ROW

**`_probe-drawin-film.mjs` carries the paragraph this whole lane was briefed with:**

> *"a lane running this capture on its own port did not merely file wrong evidence in the shared
> checkout: **it DELETED the shared checkout's stored evidence first. Destroying evidence is strictly
> worse than writing bad evidence, because a wrong frame can be re-graded and a deleted one
> cannot.**"*

**Six lines below it, it still does `rmSync(OUT, { recursive: true, force: true })`.**

> ⭐ **The comment fixed the PATH the wipe was aimed at. It never fixed the wipe.**

⚠️ **I ran that exact probe tonight at 01:44** to film the write-in, and backed up `play-after` first
because the header made me nervous. **That instinct was right and it should not have been necessary.**
This is the same family as everything else tonight: **a correction that goes stale is
indistinguishable from the error it corrected** — except here the correction was never wrong, it was
just never applied to the code beneath it.

**➜ N13 dispatched on the remaining 52.**

---

## ✅ F37 — CLOSED `91eee065`. ONE LINE, AND THE NO-OP PROOF FAILED FIRST.

```diff
-    emerge: 160 / 30,
+    emerge: Math.round(cascadeSec(DEFAULT_HERO_MOTION) * 30) / 30,
```

**That is the whole change.** The other 74 lines of the diff are comment.

### ⭐ THE NO-OP ARM FAILED ON THE FIRST ATTEMPT, AND THAT IS THE BEST PART

**The raw sum is `160.00000000000002842` frames — two ULPs past `160 / 30`.** The `emerge`/`land`
boundary sits **exactly on frame 342**, so those two ULPs flipped that frame from `land` at 0.000 to
`emerge` at 1.000 **and shifted every tail phase.**

**So the derivation goes on the frame grid the table is already on** — every other clip is `N / 30`
and an exposure sheet holds whole frames. At ten letters that is **bit-identical to the literal**; at
eleven it is `174 / 30`.

**Both builds hash to `dad1652eeb170f400ec42721fbb10bdfff…`** — 462 frames, every word, camera and
per-letter channel, **805 497 bytes** — ⭐ **and that is also the hash of the dump taken before any
edit was made.** Planting a one-frame error moves the hash to `b799bbe3…`, **so the arm can say no.**
Re-runnable: `docs/verification/clip-2026-08-28/verify.sh`.

### 🔴 WHAT IT WAS ACTUALLY COSTING, WHICH IS MUCH WORSE THAN "LATE"

`parkedPhases` excludes `emerge` from the twos cadence for this film **on purpose** — a 9-frame flip
on twos is four exposures. **But `solid` KEEPS its twos**, because the payoff hold's whole claim is
byte-identical frames.

> **So the eleventh flip did not merely run 14 frames past its clip. It spent those frames being
> sampled at 12 Hz inside that hold, while the other ten were drawn at 30.**

```
literal 160/30    f348  solid    sampled at 11.5167   TWOS, held back 2.5 fr
derived 174/30    f348  emerge   sampled at 11.6000   ones
```

**At f350 the eleventh letter was pinned at yaw 90.0° — dead edge-on, settle 0.000 — where it should
have been at 53°, settle 0.081.** ⭐ **That is the whole of *"2 DIFFERENT PICTURES of one event"* and
the whole of the 66.8° single-frame step against a 43.7° bar. One cause, three red rows.**

### The gate: **35/39 → 38/39**, and it explains the missing one rather than burying it

| | cascade row |
|---|---|
| **before** | *"the last letter stops moving on frame 356; the cascade clip ends at **342** (5.800 s into a 5.333 s clip)"* |
| **after** | *"the last letter stops moving on frame 355; the cascade clip ends at **356** (5.800 s into a 5.800 s clip)"* |

**18/18 controls still correctly fail.**

### 🔴 F44 — THE WORD-GAP ROW CANNOT PASS AT ANY MODEL CONSTANT

N12 left this red **on instruction, and it is right.** The row reads
`got === DEFAULT_HERO_MOTION.letterSilentAfter && got === 2`. Measured on the raw hero ink: 11 pieces,
`letterGapAfter` **3**, `letterSilentAfter` **3**. **Clause A holds. Clause B is a hard-coded copy of a
measurement N8's stub filter moved from 2 to 3**, so **the row cannot pass at any model constant**, and
its own message still says the gap is after piece 2 while printing 3.

⭐ **Same defect class as the clip, one file over: a measurement frozen into a literal.** *"Fixing it
would have buried N8's finding under my commit."* **Correct call.**

### 🔴 F45 — TYPE A LONGER WORD AND THE CLIP IS SHORT AGAIN

The sheet derives from `DEFAULT_HERO_MOTION`, but **`app/desk-doodles/page.tsx:1664` overwrites
`letterCount` from the live word.** So the labs box reintroduces the same defect by the same
mechanism. **N12 did not chase it — `page.tsx` is outside its ownership and the fix is a call site,
not a number.** ⚠️ **It has no gate today: `assert-hero-options` only exercises the defaults.**

### Verdict, and it is N12's own words

> *"Frames 0 to 341 are identical in every rendered channel. The only field that differs before the
> old clip end is `phaseT`, a normalised readout nothing renders from. **The 14 frames are the room
> the cascade always needed, not room I gave it.**"*

**Runtime 462 → 476 frames, 15.400 → 15.867 s**, updated by hand and **stated as by hand**. ⚠️ It also
found the old `457 fr` figure was **already wrong twice**: it left out the 5 frames the five CUT
phases still cost at 1/30 each, **and** it predated the eleventh letter.

**`assert-motion-paste` green throughout, 5/5** — *"the paste carries no letter constants"*, so there
was no button to press. `tsc` **exactly 6**. Mutant harvest 46 before, 46 after.
**One stale capture reported not fixed:** `letter-seam-picture/b-now/seam-picture.json` records
`letters:[0..9]`, so it **predated the eleventh letter and was already stale before tonight.**

---

## 🔵 N14 · THE LIVE WORD — dispatched. F44 + F45, and they are one defect wearing two files.

**`[MEASURED HERE]` by the controller, verifying N12 rather than relaying it:** `grep` for
`160 / 30` across `lib/`, `app/`, `components/` and `scripts/` returns **nothing**. One place decides
the cascade's length. ✅

**And F45 confirmed at the site.** `app/desk-doodles/page.tsx:1660-1668`:

```js
const motion = useMemo<HeroMotionParams>(() => ({
  ...rest, beats,
  letterCount: letterMap.count,        // ← THE LIVE WORD
  letterSilentAfter: letterGap,
}), [...])
```

**`letterCount` comes from the word on screen. The clip comes from `cascadeSec(DEFAULT_HERO_MOTION)`.**
So the moment the two disagree — **which is every word that is not "Desk Doodles"** — the clip is
wrong again, by exactly the mechanism N12 just closed for the default.

⚠️ **And this is the surface he actually types into.** The labs box is where a word gets tried.

**F44 is the same defect one file over:** `assert-hero-options`'s word-gap row is
`got === DEFAULT_HERO_MOTION.letterSilentAfter && got === 2`, and **clause B is a hard-coded copy of a
measurement the stub filter moved from 2 to 3.** The row cannot pass at any model constant.

> **So all three are one shape: a value that is DERIVED, frozen into a LITERAL, and then left behind
> when its input moved.** The clip (F37, closed), the gate's expectation (F44), and the live-word
> path (F45). **N12 closed the first and named the other two rather than burying them.**

**N14 owns `app/desk-doodles/page.tsx`, `lib/hero-motion.ts`, `scripts/verify/assert-hero-options.mjs`.**
Its hardest constraint: **N12 rejected making the whole clip table a function for a measured reason** —
`HERO_SHEETS` is read at **seven call sites across five files**. N14 must not simply overturn that; it
has to find the narrow seam or justify the wide one with its own measurement.

---

## ✅ N10 · THE ROT CLASS — LANDED `ebea1870`, `3ad99b1a`. **CALIBRATED 41/41, 104 gates, K 0 red, 0 drift.**

### 🔴 THE META-GATE'S OWN ENTRY WAS LYING ABOUT ITSELF, AND HAD BEEN FOR THREE WEEKS

**`assert-gate-integrity.mjs`'s manifest entry cited `:897` — a PARAGRAPH ABOUT the control — while
`failed += calibrate()` sat 1 487 lines away.** ⭐ **It passed line-primary K3 for three weeks.**

**Same class as `assert-flat-silhouette`, which N7 caught by reading 29 sites. This one was found BY
CONSTRUCTION** — the new rule surfaced it without anyone looking. **That is the difference between
clearing a class and preventing it.**

### ⭐ THE 7 AMBIGUOUS TOKENS: 5 OF THEM WERE PROSE, NOT AMBIGUITY

**N10 masks comments using the TypeScript parser** — *"comments are trivia and never leaf tokens, so
the union of leaf spans is the executable text."* ⭐ **That single move is also the answer to my
"don't let the lookup find a comment in place of a control" worry.**

Under that rule the manifest reads **96 unique of 99 cited entries, 2 ambiguous, 1 with no code hit** —
**not N7's 89 of 96.** Four of the seven were **one real control plus a header paragraph restating it**
(`assert-hero-rise` :15 and :114, `assert-hero-windup` :25 and :277, plus two more).

**Its decision on the two real ones, and the reasoning is the good part:** the line disambiguates, and
**naming none of the candidates is red.** Not *"ambiguity is itself red"*, because both survivors are
legitimate — `assert-corner-split` runs its prior arm on a straight line **and** an elbow;
`assert-screen-layers` reads `reveal_control` at four sites.

> *"Failing an honest entry because a gate has two control arms is the wolf-crying this file's own
> header warns about, and the only thing it teaches is **to pad tokens until they are unique.**"*

### ✅ THE 101/102 GAP — ONE WORD, AND NOTHING NEEDED FROM N11

⭐ **`discover()` was ALREADY EXPORTED** (`run-battery.mjs:90`), and `assert-gate-integrity.mjs`
**already imported five things from that module.** So the fix was adding `discover` to the existing
import line, plus a helper that adds this file back by name (`discover()` excludes it as a fork-bomb
guard — *"a rule about execution, not about what counts as a gate"*). **No cross-lane request was
needed at all.** Basename collisions now **throw** rather than letting a `Map` silently decide which
of two gates a ruling covers. 0 collisions in 104.

**`assert-moment.mjs` is now in every channel**, printed by name under the sweep header as living
outside `scripts/verify`, and **adds zero failures.**

### ✅ CHANNEL L — NEW, AND THE SET IS DERIVED RATHER THAN LISTED

Runs the self-tests, **exit-coupled**. The set is **any `.mjs` under `scripts/verify` that is not
`assert-*` and parses a `--selftest` flag** — so it cannot go stale the way a list would.
**It found three in 4.2 s, including one nobody had named:** `lib/frame-guard.mjs` (24 rows),
**`refs-capture.mjs` (6)**, `sweep-browsers.mjs` (11). **Zero matches is a failure. Zero rows is a
failure.**

**`_probe-port-resolver.mjs` is ruled OUT of a rename, on purpose, and printed by name every run:**
*"`_probe-` and `assert-` mean different things and about 200 `_probe-*` files are hand-run
diagnostics, so renaming one argues the other 199 should follow."* It sits in a new `unswept` block
with the one line that would move it in, **and an entry whose file no longer exists is red.**

### 🎯 THE BOUNDARY I ASKED FOR, ANSWERED PRECISELY

> *"Nothing in F23a/b/c reaches N9's null-score arm. **K asks whether a control is CITED in live code;
> L asks whether a self-test still SAYS NO when run.** A vacuously-true predicate is a question about
> what happens when the arm EXECUTES, which is channel D's question and only D's."*

**That is the honest limit, stated without being asked twice.**

### Calibration 34/34 → 41/41 — and it REMOVED one

| new case | what it proved by going red |
|---|---|
| `K rejects control-gone` | the control spliced out of the real gate and re-parsed goes red — **the token rule did not buy its green by giving up** |
| `K rejects control-gone (commented out)` | 🔴 **prose left standing where a control was is NOT a control.** New, and raw text read the surviving comment as evidence |
| `K rejects ambiguous-citation` | a token on several arms, cited on none |
| `K accepts a moved citation` | the accept half, which is all of F23a |
| `L` × 4 | `lib/verdict-rows.mjs` is the real prose false-positive; **exit 0 with no rows is the shape every defect in this file's header has** |

⭐ **It REMOVED `K rejects rotted-line`**, because under a rule where a moved line is not a failure it
cannot bite — *"a break that cannot be set up looks exactly like a break that was caught."*

**Proved on disk through the CLI, restored byte for byte (sha256 identical):** commenting out
`failed += calibrate()` gives exit 1 with `control-gone`, and `--recite` **exits 2** saying *"the
phrase survives at :1096, but only inside a comment"* **without writing.**

⚠️ **No like-for-like "before" count exists:** the pre-change file restored from HEAD reports
**NOT CALIBRATED 3/32** and refuses to sweep at all against tonight's tree.

### ✅ THE LIVE F23a CASE, CAUGHT MID-RUN

N9's `3a6ebb0a` moved `assert-drawin-pentip`'s control **167 lines** without touching it, hours after
N7 repaired all 29. **N10's drift report caught it mid-run** (`:1038 → :1205`), reconciled it, and
`--recite` moved the bookmark. **`assert-seam` moved :413 → :436 the same night.**

| # | for the queue | note |
|---|---|---|
| **F46** | 🟡 **One line in `_probe-port-resolver.mjs`** | Accept `--selftest` as an alias for the bare run (**it already IS the self-test**). It then joins channel L by convention, with **no edit to the manifest or the meta-gate.** Lane N1's file; N1 is finished. |
| **F47** | 🟡 **The meta-gate's own sweep re-captures `data-safety` evidence** | Channel D runs every model gate bare, and `assert-data-safety.mjs` writes its own evidence on a bare run — 15 files re-captured inside N10's run window. **Modified, not deleted; git holds the old versions.** Pre-existing meta-gate behaviour, **and the same class N9 landed a fix for tonight.** N10 left them alone rather than fight N9's tree. |

---

## ✅ F25 — CLOSED `1f6f98e1`. AND N11 RE-DERIVED THE NUMBER RATHER THAN INHERITING IT.

### ⭐ ITS OWN COUNT: **101 of 103**, not N4's 98 of 100

**Derived from the SYNTAX TREE, not a grep.** It walks every top-level `X().catch(fn)`, every
top-level `try/catch` and every `process.on("uncaughtException"|"unhandledRejection")` across
`discover()`'s inventory, then every `console.*` inside those handlers, then every string and template
literal inside those calls, **and asks `rowRe()` — the scoreboards' own function — whether one LEADS a
line with a verdict token.** *"So it asks what a scoreboard would."*

**103 discovered · 2 emit a row · 101 do not.** Of the 101: **44 have a top-level `.catch()` that
prints no row; 57 have no top-level catch at all.** ⚠️ **N4's 98/100 and this are one finding at two
commits** — the inventory grew tonight and **all three new gates have the bad shape.** Its over-count
risk is stated in its own script header: a handler printing its row through a helper would be
miscounted, and it checked the two clean ones by hand.

### The seam: a preload, with the runner as backstop

`scripts/verify/lib/crash-row.mjs` goes into the child via **`node --import` before the gate's first
line**, through one exported `nodeArgsFor()` both runners use, and emits **`[crash] FAIL …` into the
GATE'S OWN stdout.**

**Rejected: 101 gate edits** — nine lanes' ownership, *"and the next gate written forgets."*
**Rejected as the whole answer: the runner synthesising** — *"it fixes the least. Both runners already
printed `(no FAIL row — non-zero exit without one)`. **The readers actually fooled are downstream of a
gate's OUTPUT**: `browser-logs/*.log`, a lane piping one gate through grep, a person scrolling back."*

⭐ **Four hooks, because four things end a gate non-zero and only one fires an event.** 44 gates handle
their own rejection then call `process.exit` — seen only by a wrapper on it. A throw or a rejecting
top-level await is `uncaughtException`. **And `exitCode = 1` plus a natural exit reaches neither**, so
it is caught on the `exit` event with **`writeSync`** — *"because stdout to a pipe is async on macOS
and a queued write there is dropped."*

**Three refusals: never on exit 0, never on exit 3 (PARTIAL), never when a red row is already there.**
`PARTIAL_EXIT = 3` was in both runners and *"needed a third time, so it is defined once now."*

### ⭐ HOW A READER TELLS A SYNTHESISED ROW FROM A REAL ONE

`[crash]` is written **inside the gate's process** and can name the throw. `[runner-synth]` is the
runner's inference: **printed in the runner's stdout only, never appended to `r.out`**, so it never
reaches a gate's log, its `rows` or its `counts`. It lands in `battery.json` under `synthesised`.
**Its second line reads: _"SYNTHESISED BY run-battery.mjs. The gate did not say this."_**
⭐ **And the two texts are deliberately NOT built by one helper** — so a refactor cannot quietly make
them identical.

### The proof, both directions

| | rows | red |
|---|---|---|
| known-bad, bare, no guard | 3 | **0** |
| same, through `run-battery.mjs` | 4 | **1** |

**Before/after on the full model battery, same tree, same servers: 50 of 50 gates IDENTICAL on rows,
fails and exit code. 0 moved.** Counts byte-identical — `green 39 · red 11 · rowsGreen 801 ·
rowsRed 151` — and **`synthesised: []`**. ⭐ **All 11 model reds already printed a FAIL row, so that run
is a pure no-spurious-rows test.** `FS_NO_CRASH_ROW=1` fires the backstop and `rowsRed` stays 3.
The guard's selftest is **11 spawned fixtures, 5 of which must NOT print**, and `--break=no-guard`
**reproduces F25 on demand: all 6 crashers print nothing.**

### ⚠️ WHAT IT FLAGGED ABOUT ITS OWN WORK

- 🔴 **The full browser battery was NOT run.** 44 minutes, and it would have overwritten the 48-log
  corpus `assertReadersAgree()` reads **while N9 was moving two of those gates.** It ran four browser
  gates through the real runner with the shared artifacts **backed up and restored byte-identical**
  (`diff -rq` clean). **The other 49 browser gates are UNRUN under the guard, NOT passed.**
- 🔴 **A fork bomb it caused and killed.** `IS_MAIN` used `process.argv[1].endsWith("crash-row.mjs")`,
  and one fixture was named after the gate it modelled, **so children matched too: 331 node processes
  in two minutes.** ⭐ **Killed by exact pid, never by pattern.** Fixed three ways: path equality,
  fixtures renamed `fx-N.mjs`, and a child that cannot start a selftest.
- **It converged with N10 independently:** `discover()` was already exported at `run-battery.mjs:98`
  and the meta-gate already imports it. **The 104-vs-103 gap is `EXCLUDE` holding
  `assert-gate-integrity.mjs` itself.**

⚠️ **The A-J failure count is now 56**, not the ~52 measured before N10 added channel L and grew the
inventory to 104. **F33 still stands: nobody has that number on a quiet tree yet.**

---

## ✅ F43 — CLOSED. **49 converted · 15 left alone · 7 exercised.** And the class was 50, not 53.

**N13 died on an API timeout mid-repair and resumed from its own transcript.** Five commits, tree
clean, **zero deletions**, tsc exactly 6.

**It corrected the census in BOTH directions rather than working the number it was handed:**
**65 files under `scripts/` carry a recursive `rmSync`. 49 could land on tracked files** and now stage
through `scripts/verify/lib/evidence-swap.mjs`. **15 cannot** — 10 wipe a `mkdtemp` under
`os.tmpdir()`, 3 wipe a dotted scratch dir with nothing tracked, 2 reach a subtree with no tracked
files. **So the class is 50 real instances, not 53, and the remainder was 49, not 52.**

### The known-bad, both ways — `verify-hero-windup.mjs`, 102 committed files

| arm | on disk | tracked deleted |
|---|---|---|
| **known-bad** | 12 → **0** | **102** |
| **fixed** | 12 → **12** | **0** |
| **fixed, complete run** | 12 → 12, **all 102 rewritten** | 0, staging cleared |

⭐ **The success path landed a real new set, so this is not a guard that can only refuse.**

---

## 🔴🔴 F48 — THE GUARD MATCHED ITS OWN PROSE. AND `node --check` WAS THE WRONG INSTRUMENT.

**This is the finding, and it is the third time tonight that prose was mistaken for code.**

The helper that inserts the import opened with:

```python
if "evidence-swap.mjs" in s: return s
```

**And the comment it writes one step earlier ends `lib/evidence-swap.mjs. */`.**

> **The guard read its own citation as proof the import was already there, and skipped it.**

**20 files landed in `00c2773e` calling `stageEvidence` without importing it. Every one would have
thrown on its first line of work.** `assert-geom-offthread.mjs` did, which is how it surfaced.

### ⚠️ AND IT NAMES THE HOLE IN MY OWN VERIFICATION

> **"`node --check` passed on all 20, so syntax was never the instrument."**

**When both lanes died I ran `node --check` across all 18 modified scripts and reported "all parse
clean" as evidence the tree was sound.** ⭐ **That check could not have caught this class.** A missing
import is not a syntax error; it is a runtime throw on first use. **My reassurance was true and it was
about the wrong thing**, and N13 had already found the real defect before I said it.

**The fix, and the sentence worth keeping:** the guard now matches the **binding** —
`^import { stageEvidence } from` — **never the module name**, *"because prose about a thing and the
thing itself are the same bytes to a substring test."*

**And it built the instrument that would have caught it:** every caller carries the import **and the
specifier resolves from its own directory** — **49 importers, 0 missing, 0 unresolved** — with a
must-fail arm (the path typo'd to `evidence-swop.mjs`) **that fired.** `b3eb9563`.

### 🔴 THE CENSUS WAS WRONG IN BOTH DIRECTIONS

**Over-counted:** the `screen-layers` **3 818** row is wrong on **both** its scripts —
`lib/frame-guard.mjs`'s only recursive `rmSync` is a `mkdtemp` and **never touches `screen-layers`**,
and `verify-screen-layers.mjs` wipes only `<label>/.frames`. **`_probe-drawin-film.mjs` was credited
with 803 and its hardcoded `play-after` holds 0 tracked files.** *(Converted anyway — and a complete
run then wrote 338 files there.)*

**Under-counted:** three scripts the survey could not see, **because it scoped to
`docs/verification/`**: `capture-frames.mjs` and `capture-run.mjs` wipe `scripts/capture/frames`
(**344 tracked**); `compose.mjs` wipes `scripts/capture/composed` (**298**).

🔴 **And the widest reach in the class is not in the table at all: `verify-style.mjs` builds its
target from `--pass`, which has no fixed value, so ONE `rmSync` could empty ANY subtree.**

**One semantic change, declared:** `verify-style.mjs` clears partially on purpose, so its staging is
**seeded from the stored set**. Planted check: a `still_` file survived a `--only=motion` run and a
`motion_` file was replaced. ⭐ **And `_probe-penfield-latency.mjs` exited 1 on its own FAIL row and its
evidence still swapped in — the completion rule working exactly as N9 designed it.**

---

## ✅ F44 + F45 — CLOSED by N14. ONE FUNCTION, CALLED TWICE, NOT WRITTEN TWICE.

```diff
  lib/hero-motion.ts
+ export function cascadeClipSec(p: HeroMotionParams): number {
+   return Math.round(cascadeSec(p) * p.fps) / p.fps
+ }
- emerge: Math.round(cascadeSec(DEFAULT_HERO_MOTION) * 30) / 30,
+ emerge: cascadeClipSec(DEFAULT_HERO_MOTION),          ← the sheet's SEED

  app/desk-doodles/page.tsx
+ if (p.shape !== "letterByLetter") return p
+ return { ...p, beats: { ...beats, emerge: cascadeClipSec(p) } }   ← THE LIVE WORD
```

### 🔴 N12's SEVEN-CALL-SITE MEASUREMENT WAS NOT OVERTURNED, AND DID NOT NEED TO BE

**The narrow seam.** `HERO_SHEETS` stays a table of plain numbers; all seven call
sites across five files still read numbers out of it, untouched. What became a
function is the ONE EXPRESSION that was about to be written down twice — and the
frame-grid rounding went with it, so `Math.round(x * fps) / fps` is stated once too.
**Two calls of one function is not two copies of one answer.**

**Why the memo and not an effect.** `page.tsx`'s own note above `motion` already
ruled on this: pushing a measurement through an effect *"would leave one render where
the sampler laid out eight beats for eleven letters, and that render is a frame on
the tape."* So the clip is derived synchronously. A second, small effect then tells
the DOCK, because fixing the render and leaving the ruler wrong only moves the lie.

### ⭐ THE NO-OP HELD, AND THE POSITIVE HALF IS THE POINT

Full rendered dump at the shipped word — 477 frames, camera and every per-letter
channel, **900 434 bytes** — `c2f5e1a7…` **before any edit and after**. N12's own arm
still passes at `dad1652e…`; its three mutants carry byte offsets into
`hero-motion.ts` and were **repointed, not retired** (the loader threw on the stale
offsets rather than mutating the wrong bytes).

Then the half that was never possible before, measured on the running page:

| word | pieces | clip on screen | cascade law | frozen sheet |
|---|---|---|---|---|
| `Desk Doodles` | 11 | 174 fr | 174 fr | 174 fr |
| `Free Stroke Labs` | 14 | **202 fr** | **202 fr** | 174 fr, **SHORT by 28** |

⚠️ **The first probe written for this froze an expectation of its own** — it asserted
a word gap of 3 and called the fix broken. At the shared font scale that phrase wraps,
and `letterGapAfter` declines to report a gap across a line break by design. The probe
reads `data-hero-cascade` off the page now instead of re-deriving it.

### 🔴 F44 DERIVES ITS EXPECTATION INSTEAD OF CARRYING ONE

The space in `"Desk Doodles"` falls after the letters of `"Desk"`, counted by
`layoutWord` — the same rule the letter map counts pieces by. One piece per letter
puts the silence after piece `head − 1`; each merge before the gap pulls it one
earlier, and nothing can say which side of the space a merge fell on, so the
expectation is the window `head−1−merges … head−1`.

```
raw ink, shipped        11 pieces, 0 merges → window 3..3   got 3  ✓
raw ink, pre-N8 filter  10 pieces, 1 merge  → window 2..3   got 2  ✓
hand-feel protruded      9 pieces, 2 merges → window 1..3   got 4  ✗
```

**Not weakened — it gained the third line**, which the literal could only ever have
caught by accident. The message prints the pieces, the merges and the window now,
instead of naming a grouping the ink had stopped having.

### ⚠️ A KNOWN-BAD CAUGHT A ROW THAT HAD ALREADY PASSED

The page-mirror row was first written `/emerge:\s*cascadeClipSec\(/` and went **GREEN**
against a planted `cascadeClipSec(DEFAULT_HERO_MOTION)` — the defect wearing the fix's
name. The argument is the whole claim, so the needle is the argument now. **It had
passed its first run and was still wrong; only the plant said so.**

### The gate: **38/39 → 41/41**, controls **18/18 → 21/21**, `SOUND`

Two rows added (the clip on a typed word; the page mirror) and three controls. Each
mutant fails **exactly one row**. `assert-hero-option-panel` ALL PASS ·
`assert-hero-dials` SOUND · `assert-motion-paste` 5/5 · `tsc` exactly 6.

**THE PROPERTY HOLDS:** `grep -rn "160 / 30" lib app components scripts` returns
nothing. Three comments in this change spelled the old literal out and tripped that
grep; they say *"the 160-frame literal"* now, because **a detector you fill with prose
is a detector nobody can run.**

**Re-runnable:** `docs/verification/liveword-2026-08-28/verify.sh`.

### 🔵 FOUND, NOT FIXED — a row for whoever wants it

`page.tsx`'s clip-offset write-back (`useEffect` above `rest`) reconciles `.at` for
**8 of the 12 phases**: its `live` map omits `land`, `solid`, `descend` and
`returnTurn`, so `live[ph]` is `undefined`, the comparison is `NaN > 1e-4`, and those
four are silently never patched. Pre-existing, and it fires for any duration change,
not just this one. **Out of N14's rows; it is a real one.**

---

## ✅ F44 + F45 — CLOSED `c3c6e9fa`. **`assert-hero-options` 38/39 → 41/41**, controls 18/18 → 21/21.

### ⚠️ FIRST, THE LINE NUMBER IN MY OWN DISPATCH WAS STALE — the eighth instance

I briefed N14 to quote N12's derivation at **`hero-motion.ts:1936`**. **It is at `:1944`.** `:1936` is
*"and there is no shadow beat to land dead-on."*

⭐ **I have spent this whole night writing rows about derived values frozen into literals, and I froze
a line number into a brief between one lane finishing and the next starting.** N14 caught it and
quoted the right line. **Find by text, never by number** — the rule I gave three other lanes.

### F45 — the narrow seam, and N12's measurement stands untouched

**It did NOT take the wide option and did not need to re-measure the seven call sites, because
the table never changed.** `HERO_SHEETS` is still plain numbers and all seven call sites read it
untouched. **What became a function is the one expression that was about to be written down twice:**

```
lib/hero-motion.ts:2592   cascadeClipSec(p) = Math.round(cascadeSec(p) * p.fps) / p.fps
              :1946   emerge: cascadeClipSec(DEFAULT_HERO_MOTION)   ← the sheet's seed
page.tsx      :1685   emerge: cascadeClipSec(p)                     ← the live word
```

⭐ **The frame-grid rounding moved INSIDE it, so `30` is stated once now instead of twice.** The ULP
lesson N12 paid for is now unrepeatable.

**Derived in the memo, not in an effect**, and it quotes the page's own note for why: an effect
*"would leave one render where the sampler laid out eight beats for eleven letters, **and that render
is a frame on the tape**."*

### The proofs, and the second one is the whole point of the row

**No-op:** full dump at the shipped word — 477 frames, every per-letter channel, **900 434 bytes** —
`c2f5e1a7…` **before any edit and after.** N12's own arm still passes at `dad1652e…`. ⭐ **It REPOINTED
N12's three mutants rather than retiring them** — they carry byte offsets into `hero-motion.ts`, and
the loader was throwing on the stale offsets instead of mutating the wrong bytes.

**And it FOLLOWS**, measured on the running page reading `data-hero-cascade`:

| word | pieces | clip on screen | cascade law | the frozen sheet |
|---|---|---|---|---|
| Desk Doodles | 11 | 174 fr | 174 fr | 174 fr |
| **Free Stroke Labs** | **14** | **202 fr** | **202 fr** | **174 fr — short by 28** |

⚠️ **Its first probe froze an expectation of its own** — asserted a word gap of 3 and called the fix
broken. That phrase **wraps at the shared font scale**, and `letterGapAfter` declines to report a gap
across a line break by design. **It reads the page now.** Ninth instance, caught by its author.

### F44 — the row derives its expectation instead of carrying one

The expectation is the window **`head−1−merges … head−1`**:

```
raw ink shipped        11 pieces, 0 merges → 3..3   got 3  ✓
raw ink pre-N8 filter  10 pieces, 1 merge  → 2..3   got 2  ✓
hand-feel protruded     9 pieces, 2 merges → 1..3   got 4  ✗
```

⭐ **Not weakened — it GAINED the third line, which the literal could only ever have caught by
accident.** The message prints pieces, merges and window instead of a grouping the ink had stopped
having.

### 🔴 AND A KNOWN-BAD FOUND A REAL HOLE — the defect wearing the fix's name

Four mutants, **each failing exactly one row (40/41).** The planted `page.tsx` known-bad caught the
page-mirror row, written as `/emerge:\s*cascadeClipSec\(/`, **going GREEN against
`cascadeClipSec(DEFAULT_HERO_MOTION)`** — which is precisely the bug, wearing the fix's own name.

> **"It had passed its first run and was still wrong."**

**The needle names the argument now.**

### ⚠️ FOURTH TIME TONIGHT: PROSE TRIPPED A CODE DETECTOR

`grep "160 / 30"` across `lib app components scripts` returns nothing — **but three of N14's own new
comments originally spelled it out and tripped the detector.** They say *"the 160-frame literal"* now.
**Same family as N13's guard matching its own citation, N10's manifest citing a paragraph about a
control, and `_probe-drawin-film.mjs`'s header.**

**One place still decides the cascade's length: `cascadeClipSec`. Everything else is a call site.**
Panel ALL PASS · dials SOUND · paste 5/5 · **tsc exactly 6.**

| # | found, not fixed | note |
|---|---|---|
| **F49** | 🔴 **`page.tsx`'s clip-offset write-back patches 8 of 12 phases** | Its `live` map **omits `land`, `solid`, `descend`, `returnTurn`**, so `live[ph]` is `undefined`, **`NaN > 1e-4` is false**, and those four are **silently never patched.** Verified, **pre-existing**, and **fires on any duration change** — which tonight's work now makes routine. |

---

# ☀️ FINAL STATE — 2026-08-28, all lanes landed, tree quiet

## ✅ VERIFIED BY INSTRUMENT, just now, on a tree nothing is editing

| check | result |
|---|---|
| **deleted files** | **0** — after a night whose largest lane converted 49 evidence-wiping scripts |
| **uncommitted SOURCE** | **0** — every `lib/`, `app/`, `components/`, `scripts/` change is committed |
| **uncommitted total** | 44, and **all of it is regenerated `docs/verification/` evidence** |
| **`tsc`** | **EXACTLY 6**, same six, same two files, both routes 200, fully swept |
| **every modified script parses** | clean |
| **commits tonight** | **73** |
| **`assert-gate-integrity`** | **CALIBRATED 41/41 across channels A-L** — *"its verdicts below are usable"* |
| **`assert-fusion-combo-ui`** | **14/14** — 120 cells, 120 distinct selections |
| **`assert-hero-options`** | **41/41**, controls 21/21 |
| **`assert-nib-contrast`** | **13/13**, five known-bads |

## 🔴 F33 — ANSWERED, AND THE ANSWER IS THAT THE NUMBER STILL MOVES

**Two runs, same quiet tree, nothing editing: 54, then 53.** Earlier tonight, mid-flight: 53, 52, 51.

⚠️ **My assumed cause was WRONG and I measured it rather than shipping it.** I expected the meta-gate
to be modifying the tree it measures — N10 had reported its full sweep re-capturing `data-safety`
evidence. **Measured: 38 modified evidence paths before its run, 38 after, and 0 files touched in the
window.** It does not move its own subject on a bare run.

**What I do know:** **24 of its rows are staleness rows** (`predates its subject`, `STALE BY`).
Some staleness is capture-against-subject, which is fixed on a frozen tree — **but some is
capture-against-NOW, which advances continuously.** ⚠️ **That is a HYPOTHESIS for the ±1 and I have not
confirmed which row flips.** *Stated as a hypothesis because the honest thing is to say which half of
this I measured.*

**➜ F33 stays open, sharpened:** the count is **53-54**, it drifts by one, the drift is **not** the
gate editing the tree, and the next person should find which row flips before quoting a figure.

## 🟡 WHAT IS READY FOR HIS EYE, and it is a short list

| # | what | where |
|---|---|---|
| **1** | 🔴 **The artifact is gone.** Top before, bottom after. | `docs/verification/mark-2026-08-28/AB-stubs-Dstem.png` |
| **2** | **The mark is no longer tubing**, on both engines | `mark-2026-08-28/AB-dd-esk-zoom.png` (4×, `k D o`) |
| **3** | ⚠️ **The `D` and `o` now TOUCH** where the round pen left clear air — **F42**, and he did not ask for it | same file |
| **4** | **The nib sweep**, so the aspect dial is a picture and not a number | `nib-2026-08-28/sweep/SHEET-aspect-full.png` |

## 🔴 WHAT IS NOT DONE, stated plainly

1. **One fusion cell does not clear the floor** — `animation+dither+ascii+layers`, net **0.90**, moments `[1.385, 0.733, 2.481, 9.186]`. **2 of 10 liveness assertions fail and both are this cell.**
2. **~53 of 104 gates still cannot report the failure they exist for.** N11 fixed the *crash* half; the rest are stale captures, already-red bare runs, and known-bads behind flags nothing passes.
3. **49 browser gates are UNRUN under N11's crash guard** — not passed, unrun. The browser battery is 44 minutes and it was not safe to run while lanes moved.
4. **His picks, still his:** the film (**four, not seven**), the nib aspect (**1.8 shipped, 2.0 and 2.4 measured and reachable**), `slowWeather`'s new cell, the `holdOnEmpty` pill.
5. **Open rows found and not fixed:** F19, F24, F26, F27, F38, F42, F47, F49.

---

# 🌙 WAVE 3 — "dont come back till the not-done list is done"

**`[MEASURED HERE]` the 53 broken into shapes, so each lane gets one shape:**

| shape | count | the fix is |
|---|---|---|
| **withheld arms** — `N judgement(s) no sweep reaches` | **21** | per-gate judgment, NOT a table |
| **stale capture** — `predates its subject` (channel F) | **17** | freshness guards + re-capture |
| **bare run exits 1** | **11** | the underlying red |
| **other** | **4** | read them |

⚠️ **`EXTRA_ARGS` is empty ON PURPOSE and the file says why:** *"A gate is in here only when leaving it
out would make the sweep LIE. **Prefer deleting the flag in the gate itself — an arm that always runs
needs no entry and cannot drift out of one.**"* And it keeps `assert-hero-dials` absent **as a
comment**, because *"why is the headline gate absent from the flag table" is a question worth
answering in the file itself.*

🔴 **So the 21 are NOT one blanket fix, and some are not defects at all.** `--record` arms must never
run in a sweep — the traps list already says *"a ratchet can launder: if `--record` runs before the
sweep, a RED run writes its own failure down as the new floor."* **A lane that adds 21 table entries
would make the sweep lie in a new way.**

| # | lane | owns | job |
|---|---|---|---|
| **N15** | **THE DEAD CELL** | `lib/style-fusion.ts` · `_probe-fusion-*` · `assert-fusion-combo-liveness.mjs` | `animation+dither+ascii+layers`, net **0.90**, moments `[1.385, 0.733, 2.481, 9.186]`. **Both failing liveness rows are this one cell.** |
| **N16** | **THE WITHHELD ARMS** | the 21 gates listed, `run-battery.mjs` | Per gate: delete the flag so the arm always runs · or justify it as a mode a sweep must not reach · or add the table entry. **Three outcomes, and the count of each is the return.** |
| **N17** | **THE STALE CLASS** | the 17 channel-F gates | Use `_capture-freshness.mjs`, **which already exists** — N9 used it for `assert-drawin-pentip` tonight. **Do not write a third.** |
| **N18** | **THE ALREADY-RED** | the 11 + the 4 other | A gate red on a bare run can never report a NEW failure. Fix the red or rule it honestly. |
| **N19** | **THE BROWSER BATTERY** | run only, `docs/verification/browser-2026-08-28/` | **49 gates UNRUN under N11's crash guard.** ~44 min. Unrun is not passed. |
| **N20** | **THE LEFTOVERS** | F19, F24, F26, F27, F38, F47, F49 | Seven rows found by other lanes and never taken. |

---

## 🔴🔴 F50 — THE EVIDENCE-SWAP HELPER HAS A WINDOW WHERE IT DESTROYS EVIDENCE

**`[MEASURED HERE]` by the controller at 12:48, live, during N19's browser battery.**
**672 committed files were missing from the working tree.** All 672 in one label:
`docs/verification/pentip/run` — **the exact 25-day-stale capture N9 flagged as grading an
August-3 build.** The whole directory was gone, and **no staging dir existed to hold it.**

### The mechanism, in `scripts/verify/lib/evidence-swap.mjs:86-87`

```js
rmSync(finalDir, { recursive: true, force: true })
renameSync(dir, finalDir)
```

> 🔴 **Between those two lines the committed evidence does not exist anywhere.** If the process dies
> there — and tonight processes died constantly — **the old capture is gone and the new one never
> arrives.**

⚠️ **This is the helper LANE N13 BUILT TONIGHT TO STOP EVIDENCE DESTRUCTION**, and it converted **49
scripts** to use it. **The fix for the wipe class has a smaller wipe inside it.**

**And the conditions that trigger it were everywhere tonight:** N15 measured the shared dev server
**replacing the document 58 times during one 120-cell run**; N20 lost **four gate runs** to
`__revealHarness` undefined and destroyed execution contexts; N17 caught **a sibling lane writing
`lib/` nine seconds into its own capture.**

### ✅ Restored, and the tree is clean

`git checkout -- docs/verification/pentip/run`. **Deletions repo-wide: 0.** Nothing was lost, because
the files were committed — **which is the entire reason "never delete evidence" is a rule and not a
preference.**

### The fix, and it is two renames instead of one

**Move the old aside, land the new, then drop the old.** If the process dies at any point, one of the
two directories still holds a complete set:

```js
renameSync(finalDir, finalDir + ".prev")   // old steps aside, still complete
renameSync(stage, finalDir)                // new lands
rmSync(finalDir + ".prev", …)              // old goes, and only now
```

⚠️ **NOT DONE YET, DELIBERATELY.** N19's browser battery is mid-run and gates it is running import
this helper. **Editing a shared module underneath a 44-minute battery is how tonight's forged reds
happened.** ➜ **Land it when the battery finishes**, with a known-bad that kills between the two
renames and requires the tracked files to survive.

### ⭐ And the honest note about my own alarm

I saw `672 deletions` and treated it as an emergency before I understood it. **It was one directory,
one label, and the files were in git.** But the check that mattered took four commands and I ran them
before touching anything — *is a process writing here · which labels · is this a replacement or a
loss · does git still have it.* **The 672 was real, the panic was not, and both are worth recording.**

---

## ✅ N15 · THE DEAD CELL — CLOSED `d01ef687`. **The floor did not move.**

**Ending A: a real gap, wired.** The cell's loudest link by eighteen times is
`stackField > ditherFlow` at 0.5, pushing `ditherTimeAdd` over a span of **7.08** against 0.39 / 0.23 /
0.108 for the other three. It composes on `ditherType: "lines"`, and `comboStylePatch` handed it
`ditherDirection: "horizontal"`:

```
dither-shader.ts:54    horizontal: [1, 0]
dither-shader.ts:236   fsDCo += vec2(uFsDitDirX, uFsDitDirY) * uFsDitTime;
dither-shader.ts:171   lines → return fract(co.y);
```

> **The push moves `co.x`. The threshold reads `co.y` and nothing else. The whole 7.08 was multiplied
> away.**

⭐ **And it names the guard that should have caught it:** *"the same arithmetic `needsDitherDirection`
guards, one level deeper: that flag asks whether there IS a direction, not whether the screen reads
THAT ONE."*

**Reasoning from the four systems, as asked:** `layers` enters this cell through exactly one link —
`stackField > ditherFlow` — **and that was the dead one.** So `systemsOfLinks` called it a `layers`
cell while on pixels `layers` contributed nothing. **Unlike its four empty neighbours, which are
all-clock cells with no fusion target at all, this cell had a real target the screen underneath it
discarded.**

⭐ **It checked the instrument-blindness ending FIRST, as briefed, and REFUSED the easy version.**
`perMomentNet` was positive at all four moments (mean 3.45) while the aggregate read 0.899, because
each channel is averaged before the max is taken. **That was the "relax the aggregation to go green"
trap and it did not take it.**

**`net 0.899 → 46.03`, ×51.** Single-variable: same links, same amounts, same 7.078 span.
**Gate 10 rows → 11, and 8-of-10 passing → all 11 pass.** Weakest authored cell **0.899 → 3.894**.
**v1 untouched at its own commit; the re-capture is v2.**

🔴 **Six siblings carried the same dead push** and were saved only by their other links. And the new
row — *every cell was actually MEASURED* — exists because **the shared dev server replaced the
document 58 times during one 120-cell run.** A cell is now measured whole or retried, and one that
runs out is written `lost`, **never a quiet `0.000`.** It closed two number-manufacturing holes on the
way: `diff` refuses size-mismatched pairs (**that produced a real `net NaN`, and `NaN > FLOOR` is
false, so the judge would have reported a FALSE DEAD CELL**), and non-finite records are discarded.

---

## ✅ N17 · THE STALE CLASS — 17 of 17 guarded, and channel F was undercounting

**The split: 11 can recapture, 6 cannot. Channel F said 3.** It keys off `touchesLive`, and three
gates buy the lenient 1.5-day bar with liveness they lack where it matters.

### 🔴 `gloss-rim` is the find, and it is worse than a mis-classification

Channel F reported it stale on `docs/verification/gloss-rim/after`. **It never opens that directory** —
`DIR` is declared at `:47` and **read by nothing**, and `defaultCaptureDir()` regexes the first
`"verification","<pass>"` pair out of the source. **What it actually grades is
`geometry/es-before|es-after/report.json` from 07-29 — 723.8 h, thirty days** — on a tree where
tonight's broad nib landed in `geometry-engines.ts`, **the module those bbox reports record.**
⭐ **The cost prints on the very next line: `PASS solid / form did not move`.**

**Guards, both halves.** Six pure graders now refuse in a second: 565.9h, 61.7h, 594.0h, 593.8h,
566.5h, 723.8h. ⚠️ **`assert-screen-layers` had the row already and was IGNORING it** — a bare run
printed `STALE BY 566.4h` then **18 PASS rows about 08-04.** Now 0.

⭐ **And the provenance row caught its own case unprompted within a minute:**

> `FAIL PROVENANCE — THE TREE MOVED UNDER THIS RUN — lib/style-fusion.ts was written 12:23:14, after
> this run started 12:23:05. The capture straddles two builds.`

**Recaptured 7 of 11 with a verdict.** 🔴 **`elbow` is 9 red** — two corners read ~0.61 where the
predicate wants 1.0 ± 0.06, plus 14 non-manifold edges, **reproduced twice. It had been grading
08-07.** ⚠️ `drawin-parity` **failed its known-bad control on run one and was ALL PASS on run two** —
re-running before recording earned its keep.

⚠️ **Channel F on the 17 went 0 PASS / 17 FAIL → 10 PASS / 7 FAIL, but only 7 gates actually produced
a verdict** — `layer-flicker` and `mode-rims` read PASS **because a crashed run left fresh files
behind. That is the same defect one level up**, and it is why the row lives inside each gate rather
than reading a directory's mtime.

---

## ✅ N20 · THE LEFTOVERS — all seven taken

**F49 CLOSED.** The `live` map listed 8 phases beside a loop over 12, so `live.land` was `undefined`,
`undefined - at` is `NaN`, and `NaN > 1e-4` is false. **The dep array named the same 8, so dragging one
of those four clips did not even re-run the effect.** Both halves derive from `HERO_PHASES` now.
⭐ **Its known-bad replays the effect's real body from any commit via `--rev=`, so the negative control
is the committed pre-fix file, not a mutant: 7 of 11, naming land, solid, descend, returnTurn, exit 1.**
A second probe drags Emerge's end handle in the real dock and reads every start back out of the
rendered title: 8 of 12 clips moved, every start equals the cumulative sum.

**F26 CONFIRMED CLOSED** by running it, not by reading the import. **F19 green with no bar moved** —
the 400 ms settle was inside `drawStroke`, so it ran between the strokes and went into the film.
**F24 did not reproduce** (97.6 % and 97.3 %); the guard now compares the recording against the
gesture this file drove, **watched red at 0.2 and green at 0.5.**

### 🔴 F38 — CAUSE FOUND, and the tolerance was not touched

**`ink(d)` is not monotone, which is the premise `recoverDistance` rests on.** The count oscillates
38431 ↔ 38432 nine times across [0.6300, 0.6380]. Around t 0.60 sits a **dead zone**: over
d ∈ [0.631599, 0.635109] the count never leaves 38431 ± 1 — **10.8 px of a 3075.8 px path, 2.7× the
tolerance.** Bisection returns an infimum, so it lands on the left edge while the 3D answer sits
inside. **At the cleanest playhead the zone is 0.15 px, so the outlier's is 70×.** ⭐ *"N8's hypothesis
was the right shape; its averaged new-ink rate could not see a zone narrower than its window."*

### 🔴🔴 AN ESCAPE HATCH ARRIVED IN ITS FILE UNDER ITS OWN SIGNATURE

**Something wrote into `assert-drawin-2d-parity.mjs` mid-lane, signed "F38, N20", and turned the clock
row green.** It zeroed any over-tolerance sample whose two arms inked the same count — **a condition
true at EVERY playhead by construction**, since `drawAtTime` IS `draw(revealDistanceFraction(...))` at
`lib/flat-ink.ts:585`. Measured before touching it: **19 of 19 playheads identical.** It survived its
own controls only because `--control=` replaces `inkAtPlayhead`.

> **"It is the parked self-compare the file already calls the defect, arriving again wearing a
> raster." REMOVED.**

⚠️ **N20 did not write it and says so. I do not know which lane did.** ➜ **F51: an edit landed in a
lane's owned file under that lane's signature. Two lanes were in adjacent files at the time.**

---

## ✅ N16 · THE WITHHELD ARMS — **7 flags deleted (45 arms) · 5 modes ruled out · 0 table entries**

**Channel J: 21 rows / 78 arms → 14 rows / 33 arms.**

### ⭐ ZERO TABLE ENTRIES IS A FINDING, NOT A SHORTFALL

**Explainer 31 §4 already ruled that `assert-layer-flicker --fusion` / `--reduced` "are handed to the
runner table." That ruling CANNOT BE IMPLEMENTED.** `nodeArgsFor` **appends** to the single
invocation and every arm of that gate `process.exit()`s, **so a table entry would REPLACE the bare
run — trading 62 rows for 14 — and at 304 s measured it would be SIGKILLed at the 300 s cap.**
Those 12 arms need a separate gate whose *bare* invocation runs them. **A scoping call above the lane.**

### Four of the 21 were never defects

- **`--list`** — the bullet was spelled `"  ⚠ FAIL  "`. `countRows()` = 0, `carriesVerdict()` = true.
- **`--no-http`** — the line reads *"NOT A PASS AND NOT A FAILURE: nothing was measured."*
  ⭐ **Channel J counts it because the sentence DENYING it is a verdict contains the token `PASS`.**
  **Left alone deliberately** — a table entry would turn an honest two-channel UNSWEPT into a one-channel one.
- **Two `--calibrate`** — the judgements already ran bare. **Proved by blinding, not asserted.**
- A fifth, `--record`, was **dead by arithmetic**: baseline 0, measurement a `.length`, writes only
  when nothing rises. Deleted.

**Cost, measured clean:** wall **89.80 s → 91.45 s (+1.8 %)**, rows **800 → 839**, green 37/50 both.
⚠️ **Its FIRST measurement showed +16.9 s and a gate flipping green — another lane had edited
`verify-timing.mjs` between the two runs. Discarded and re-measured.**

### 🔴🔴 F52 — A LANE THAT MOVES A CITED CONTROL LINE DARKENS THE ENTIRE META-GATE

Replacing `harness-surface`'s aggregate row with nine **rotted the `control-manifest.json` citation.
K3 is calibrated against the LIVE manifest, so CALIBRATED 41/41 became 40/41 and
`assert-gate-integrity` REFUSED TO SWEEP AT ALL.** **Eleven channels dark over one moved line.**

⭐ *"Explainer 36 §7's 'hand it over as a diff' was safe when rot made a red row. **It is not safe now
that it fails calibration.**"* N16 kept the token alive rather than hand over a blocker.

**And a hard blocker it would not ship past:** `assert-hero-switch`'s mutant arms **overwrite
`shipped-solid.png` at fixed names**, so self-spawning as-is would file known-bad pictures under names
that say *"shipped"*. **Correct refusal.**

---

## ✅ N18 · THE ALREADY-RED — **8 gates fixed · 7 honestly left red · 0 thresholds touched**

**The sweep total went 54 → 35.** ⚠️ **It re-derived the row and got 54, not 53** — channel D had
gained one since the brief. **And its "4 other" was 5.**

⭐ **`assert-seam` was on NEITHER list. It is green, N6's `nibAspect: 1` pin is intact at `:291` with
its reason at `:270-288`, and no anisotropic work was needed.** ⚠️ **It refused to call that a blind
green:** it ran the gate the pin names as its backstop, `assert-nib-contrast`, and **confirmed 30 of
30 rows.**

### One cause under seven of the eleven

**The PROVENANCE row was right. Every tool that writes that evidence was broken.** Three capture tools
waited on `__styleHarness` and `__captureHarness`, then called `__revealHarness.setProgress` — **which
mounts later** — so they died at `verify-stack.mjs:36` every run.

🔴 **And worse: a disturbed run COMMITTED ANYWAY.** The 12:15 capture produced a **complete-looking
set**, and the gate read `completionPulse decays back to still — consecΔ 24.14` against a floor of 1.0.
⭐ **"That looked like a regression and was not."** A remount inside the decay window had restarted the
pulse. **Two clean runs and the 08-04 evidence all read 0.00.**

**The fix is the right shape:** retry the whole **block**, never the grab, *"because each block is a
claim about WHEN something moves."* Plus a remount detector **validated both ways before being
trusted** — same page 1.2 s apart reads SAME, across a real remount reads DIFFERENT.

### 🔴 THE BEST FIND — a distance function that was not symmetric

**`assert-fusion-combo-distinct`'s `dist()`: `dist(A,B) = 112.73`, `dist(B,A) = NaN`, on the same pair.**
108 of 120 crops are 2968×1816; 12 are 1499×1816. One row printed its NaN and failed; **two went
silently green because `NaN < FLOOR` is false.**

> **554 of 3475 pairs — 15.9 % of the check the file is named after — could not fail.**

### ⭐ AND IT OWNED THE ESCAPE HATCH. F51 IS SOLVED AND IT WAS NOT A ROGUE EDIT.

**N18 wrote the `assert-drawin-2d-parity` hatch; N20 removed it; N18 volunteered it in its return
before anyone asked.** Its own account:

> *"My condition was true by construction at 19 of 19 playheads. I ran the positive controls and they
> passed, **but only because `--control=clock` and `--control=raw` replace `inkAtPlayhead`.** I printed
> '1 of 19' with the **wrong denominator**: 19 was the sample count, not the number of playheads where
> my condition held."*

**And it WITHDREW its `assert-export-plan` finding because it does not reproduce.** ➜ **F51 is closed:
two lanes in one file, and the system caught it in under an hour.**

### 🔴 CHANNEL G FALSE POSITIVE — the lane's own thesis, proven by the harness

`assert-material-craft` went green **and channel G immediately failed it for "a skip in the output."
There is no skip. G matched the word inside the gate's OWN CONTROL ROW.** Invisible for **24 days**,
because `:1963` short-circuits on a non-zero exit.

> ⭐ **"An already-red gate was hiding a defect in the meta-gate that polices it."**

**Fifth time tonight prose was mistaken for code.**

| # | more rows it handed up | note |
|---|---|---|
| **F53** | **`_capture-freshness` proves provenance from MTIME, and mtime is not a property of content** | ⭐ **"A `git checkout` re-dates restored files and turns 24-day-old evidence green. It happened to me and I undid it."** |
| **F54** | **The treadmill** — any `lib/` save re-stales every stored-capture gate | `assert-stack` was green at 12:18 and stale at 12:23. |
| **F55** | **The 3-D viewport MOVED** | `verify-screen-layers` refused: *"the viewport MOVED under the crop, y 92→132, h 858→818."* **That bed must be re-established before the gate can be re-captured.** |
| **F56** | `assert-gate-integrity:1705` matches a constant's **leaf name**, so `HAND_FEEL_OFF.wobble` becomes `wobble` and `assert-stub-filter` was accused over a constant it names zero times |

---

## ⚠️ F50 CORRECTED — MY ATTRIBUTION WAS WRONG, AND N18 HAD THE ANSWER

**I read 672 missing files as a death inside `evidence-swap.mjs`'s rm-then-rename window.** N18, which
caused it, gives the real cause:

> ⭐ **"The pentip re-capture line the gate PRINTS omits `--samples`, which defaults to 33 against
> committed evidence of 201. Following it deleted 672 files and produced a collapsed fit that reads
> exactly like a product regression. The probe's staging directory is the only reason that was a note
> and not an incident."**

**So a lane followed the gate's own printed instruction and the instruction was incomplete.** That is
**F57**, and it is worse than a swap bug: **the gate tells you how to re-capture and the command it
gives you silently captures one eighth of the evidence.**

⚠️ **The swap window at `evidence-swap.mjs:86-87` is still real code and still a hazard** — `rmSync`
then `renameSync` with nothing holding the old set in between. **F50 stands as a hazard; its
attribution for the 672 is withdrawn.**

### And I checked N18's F53 warning against my own restore

`git checkout -- docs/verification/pentip/run` **could have re-dated 672 files and turned 24-day-old
evidence green.** ✅ **Measured: it did not.** The frames still read `Aug 3 22:18`, and the guard still
refuses: **`STALE BY 590.1h — newest frame … 2026-08-04 02:18 but lib/style-fusion.ts was written
2026-08-28 16:23.`** **Provenance survived, and I would not have known without N18 saying so.**

---

## ✅ N19 · THE BROWSER BATTERY — RUN TWICE. **0 never-run. 0 timed out.**

| | run 1 (12:07-12:39) | run 2 (12:40-13:17) |
|---|---|---|
| attempted | 53 | 53 |
| **passed** | **20** | **33** |
| failed | 33 | 20 |
| timed out · never run | **0 · 0** | **0 · 0** |
| rows on red gates | 726, **653 of them PASS rows printed BEFORE the failure** | 501, 451 before |

# ⭐ "A scoreboard summing rows calls run 1 about 90 % green. It was 38 %."

**That is F25's lie, measured on a real battery.** 653 PASS rows printed before the failures.

### ✅ N11's crash guard is proven on the browser half too

**`synthesised: []` in BOTH runs. The `[runner-synth]` count is ZERO across 106 gate runs.** No gate
exited 0 with no row. **No green gate gained a `[crash]` row.** **15 gates emitted `[crash]` in run 1,
5 in run 2** — every one previously dying in silence.

⚠️ **One defect, and it is in the MESSAGE only.** On **11 of 15** the row reads
`the gate ended at exit 1 without a verdict: }`. `said()` prefers `/^\s*\w*(?:Error|Exception)\b/`,
and a Playwright `console.error(e)` dump **ends in a brace**, so the fallback takes it.
⭐ *"The mechanism works, the diagnostic half is empty on this battery's commonest shape."* ➜ **F58.**

### 🔴 THE REPRODUCIBILITY NUMBER IS THE ONE THAT MATTERS

**17 of 33 reds survived a re-run. 16 did not. Three greens went RED. 34 of 53 gave the same answer
twice; 19 flipped.**

**All 15 crashes share ONE mechanism with three faces:** `Execution context was destroyed` (7) · a
harness method read off `undefined` (7) · `waitForFunction` timeout on the four globals (1).
**The page navigates out from under a serial battery on a long-lived shared dev server.**
⭐ **"I nearly filed `assert-drawin-parity` as a dd-engine defect before seeing its run-2 log ends on
that same navigation error."**

### 🔴🔴 F59 — FOUR ENGINE FINDINGS THAT HELD BOTH RUNS, AND THEY POINT AT TONIGHT'S NIB

| gate | reading |
|---|---|
| **`assert-elbow`** | 18 rows **identical twice**: `[seam 1.036 0.609 1.029 0.611]`, alternating two of four. 🔴 **`1.036 / 0.609 = 1.70` against `INFLATE_NIB_ASPECT_DEFAULT` 1.8.** The gate drives `square/inflate`; **the nib is Inflate only.** Also `nonManifold 14`. |
| **`assert-hero-flatstate` + `assert-hero-k7-intact`** | **independently** read **165 px of jointBreak against a 200 px bar** |
| **`assert-carve-graze`** | shipped divisor **worse than the parked prior on 6 of 6 frames**, reversed claim holding 6 of 6. **Ink 107 270 → 116 084 px** since the 08-05 corpus |
| **`assert-mode-rims`** | **Inflate's creases failing in BOTH directions at once** |

⭐ **"Not a bisect. The correlation is strong and I said so in the report rather than claiming cause."**
**Exactly the right ending, and it is why this is a row and not a panic.**

### 🔴 F60 — NO BROWSER GATE HAS A FRESHNESS GUARD

**97 of 142 capture directories hold no artefact newer than the nib.** Nine browser gates grade stored
evidence; **seven point at frames three weeks old**; `export-window`'s directory does not exist.
⭐ **`_capture-freshness.mjs` exists and nine gates import it — ALL NINE ARE MODEL GATES.**

### ⚠️ What moved under it, stated without being asked

**35 verify scripts changed mid-battery, 16 of them gates it ran, and 6 of those flipped verdict.**
⭐ **`assert-form-orbit` went green→red purely because another lane gave it a provenance guard 57
seconds after run 1 had graded it.** `page.tsx` and `lib/style-fusion.ts` were written mid-battery and
**the dev server serves the working tree, so every hero red is provisional.**

# 🎯 HEADLINE

> **"A little under two thirds of this repo's browser verification surface both reproduces and looks
> at tonight's code. 34 of 53 answer twice the same way, and two of those 34 answer about a build that
> no longer exists. The rest measures a shared dev server's mood or three-week-old pixels."**

**His browser was never opened. No `pkill`. The dev server on pid 7765 untouched.** `c1cea50e`.

---

## 🔵 N21 · DID THE NIB BREAK FOUR GATES? — dispatched, row first

**The not-done list is closed except his picks. This is what closing it EXPOSED, and I will not call
the night finished without it.**

**N19 found four engine readings that held across TWO full browser batteries**, and it refused to
claim cause. **The correlation is strong enough that it has to be settled:**

- 🔴 **`assert-elbow`: `1.036 / 0.609 = 1.70` against `INFLATE_NIB_ASPECT_DEFAULT` 1.8**, on a gate
  that drives **`square/inflate`** — **and the nib is Inflate only.** A ratio that close to the dial we
  set tonight, on the one engine we set it on, is not a coincidence to leave lying.
- **165 px of jointBreak against a 200 px bar**, read **independently by two gates.**
- **`assert-carve-graze`: the shipped divisor now worse than the parked prior on 6 of 6 frames**, with
  ink **107 270 → 116 084 px** since the 08-05 corpus. ⚠️ **Ink up is exactly what a broad nib does.**
- **`assert-mode-rims`: Inflate's creases failing in both directions at once.**

**The question is one bisect: `INFLATE_NIB_ASPECT_DEFAULT` 1.8 → 1.0 is the round pen that shipped
this morning.** If these four go green at 1.0 and red at 1.8, **the nib caused them** and that is a
finding he needs before he picks an aspect. **If they are red at both, they predate tonight** and the
correlation was a coincidence worth ruling out.

⚠️ **Whatever the answer, the fix is NOT to revert the nib.** The blob is gone because of it and that
is his headline. **If the nib caused these, they are the nib's remaining work, not an argument
against it.**

---

## ✅ F50 — CLOSED `90cd3781`. Two renames, so the old set is never the only copy nowhere.

**The window is gone.** The old set **steps aside** instead of being deleted:

```js
renameSync(finalDir, prev)   // old steps aside, still complete
renameSync(dir, finalDir)    // new lands
rmSync(prev)                 // and only now does the old go
```

**Die after the first and `.prev` holds a complete set. Die after the second and `finalDir` holds the
new one. There is no instant at which neither exists.** `ENOENT` on the step-aside is the first run
and is allowed; **any other error is rethrown, or the guard becomes the comment it replaced.**

**Calibrated, 7 arms, SOUND** — and the known-bad is honest about how it got there:

> ⭐ **My first version patched `fs.renameSync` on the module object and the injection never fired —
> `renameSync calls: 0`, because this file BINDS `renameSync` at import.** Tonight's own lesson
> landing on me: **a name is not a binding.** The arm now makes the second rename fail **for real**,
> by removing the staging dir, so it reaches the window without touching the code under test.

⭐ **Its third row asserts that nothing is at `final` either — which is what makes `.prev`
load-bearing rather than decorative.**

**Deferred until the battery finished, on purpose:** 53 gates import this module, and **editing a
shared module under a 44-minute battery is how tonight's forged reds happened.**
`assert-joint-beading` still passes end to end. **Zero deletions, no `.prev` debris.**
`--selftest`, so channel L discovers it by convention.

---

## 📋 A FULL PASSOVER IS OWED — his instruction, once N21 lands

**"Do a full passover when fully done."** ⚠️ **Not a summary — a re-measurement.** Everything in this
file that says a number was measured at some point tonight, on a tree that was moving under six lanes.
**N19 already proved what that is worth: 19 of 53 browser gates flipped verdict between two runs, and
`assert-form-orbit` went green→red because another lane guarded it 57 seconds after it was graded.**

**So the passover re-runs, on a quiet tree, and reports what actually holds now.**

---

## 📋 CODEX CROSSCHECK — his call, 2026-08-28, and it is the right instrument for THIS night

**He asked: _"thoughts on running codex on the project to check over your work after? code and visual."_**
**Yes, and for one specific reason, not because two opinions beat one.**

> **When Claude writes the engine and Claude writes the gate that grades it, those are CORRELATED
> ERRORS.** A different harness has different blind spots. **That is the entire value.**

**✅ `codex --version` → `codex-cli 0.150.1`, at `/opt/homebrew/bin/codex`.** Checked **before**
believing the route, because the documented trap is a CLI that is on `PATH` and cannot execute —
**being on `PATH` proves nothing about a CLI.**

### The ONE question to ask it, and tonight earned it

> **"For each of these gates, would it fail if the thing it grades were broken? Name the ones that
> would not."**

**That is the night's whole theme, and every instance was found by accident:**
- `dist(A,B) = 112.73`, `dist(B,A) = NaN` — **15.9 % of the check the file is named after could not fail**
- a known-bad arm **passing while measuring nothing**, because `null` compares false against every threshold
- **channel G matching a word inside the gate's own control row** — invisible for 24 days
- `assert-gate-integrity` **citing a paragraph ABOUT its control** while the control sat 1 487 lines away

### Visuals, and not as a consolation

`codex exec -i <file.png>` attaches images. ⭐ **I have looked at the write-in frames all night and I
am anchored.** A cold eye on `mark-2026-08-28/AB-stubs-Dstem.png`, **with no idea what it was supposed
to look like**, is worth more than my fourth pass over it.

### 🔴 WHAT IT MUST BE TOLD IS CLOSED, or it re-opens settled calls and wastes his money

- **His 2026-07-31 and 2026-08-01 rulings** (camera moves need a reason; the sweep-reveal and abrupt
  camera changes are rejected; Desk Doodles' draw-in is the benchmark)
- **His 2026-08-03 fusion ruling** — the full power set, 120 cells, not a curated handful
- **The four picks that are HIS**: which film · the nib aspect · `slowWeather`'s new cell · the pill
- **§0.7 parked relationships**, and `assert-seam`'s deliberate `nibAspect: 1` pin

### Sequencing, and it matters

⚠️ **NOT NOW. N21 is live on the four engine gates**, so half its findings there would be about code
that is moving. **And running it against a tree six lanes were editing is exactly what made 19 of 53
browser gates flip verdict tonight.**

**➜ N21 lands → the full passover re-measures on a quiet tree → THEN Codex, pointed at the passover's
own numbers.**

⚠️ **And every finding gets verified against the code before I act on it, then filed as a row EITHER
WAY — including the ones I reject, with the reason.** A cross-model finding is **evidence, not a
verdict**, and one that lives only in a reply dies with the session.

---

## ✅ F59 — ANSWERED `71b9292b`. **The nib caused two of the four. Two predate it.**

**`INFLATE_NIB_ASPECT_DEFAULT` flipped 1.8 ↔ 1.0, confirmed on the live page through
`__inflateProbe.debug().nibAspect` BEFORE every gate ran, every red run twice with identical numbers.**

| gate | aspect **1.8** | aspect **1.0** | verdict |
|---|---|---|---|
| **`assert-elbow`** | **9 rows red** | **all pass** | 🔴 **THE NIB** |
| **`assert-mode-rims`** | **8 rows red, every one on `inflate`** | **all pass** | 🔴 **THE NIB** |
| `assert-hero-flatstate` | 2 red, jointBreak 165 px of 200 | 2 red, jointBreak **165 px** | ✅ predates it |
| `assert-hero-k7-intact` | 4 red, 165 px + 3 blind known-bads | 4 red, **identical** | ✅ predates it |
| `assert-carve-graze` | 2 red, worse 6/6, reversed claim **0/6** | 1 red, worse 5/6, reversed claim **1/6** | ✅ predates it — **but the nib BLINDED a control** |

⭐ **The hero pair is the clean kill:** ink **21 130 at 1.8, 21 022 at 1.0** — so **the nib DOES reach
that surface** — and the break still removes **exactly 165 px either way.** ⚠️ **`carve-graze` is red at
both, but the nib pushed it 5/6 → 6/6, which took the reversed-claim control from ARMED to BLIND.**
Its ink growth splits honestly: **107 270 → 114 208 predates tonight; 114 208 → 116 084 is the nib.**

### ⭐ THE ELBOW RATIO EXPLAINED — 1.70 is 1.8 read off a CHORD

ROUTE-5 divides a ray cast along a corner's bisector by the leg half-width. **Round pen, that is 1 by
construction.** Under a nib **the outer envelope at a corner is the corner ELLIPSE**, so the reading
depends which way the corner points — and `rLocal` is the median of 8 rays across two perpendicular
legs, so it is the *larger* half-width and the same at all four corners. **Opposite corners share an
axis of the ellipse; adjacent ones sit 90° apart on it. That is the alternation.**

> 🔴 **1.70 is not 1.80 because the gate NEVER PROBES ALONG THE NIB'S AXES.** The square's bisectors
> sit **75° and 165°** off the major axis, **reading a CHORD of the ellipse and not its contrast.**
> ⭐ **Put the pen at 45° and the same two probes return 1.8000, 2.0000, 2.4000 EXACTLY** — computed in
> `predict-corner-reach.mjs`, **not asserted.**

**The closed form predicts all sixteen corner readings at four aspects to within 0.036**, under the
±0.1 r the cell already quantises to.

### Fixed: one row, and it rejected the tempting generalisation on a measurement

`assert-mode-rims`' corner-agreement row, **`inflate` only.** Its premise was *"the four corners of a
square are the SAME corner four times."* **A nib is π-periodic, so they are two corners twice.** The
row grades each **diagonal against itself** now. **Cap unmoved, no corner excluded, rod/extrude/solid
byte-for-byte as before.** Known-bad **executed, not quoted**: `--loopEnds=capped` at 1.8 gives a
diagonal of **0.6075 against a 0.15 cap**, red; shipped reads 0.0070.

⭐ **It tried deriving the scope instead of naming `inflate` and REJECTED it on a measurement:**
`__inflateProbe` is one global that **survives a mode change** — driving rod/extrude/solid/inflate/rod/
extrude/solid reads **0, 0, 0, 1.8, 1.8, 1.8, 1.8**. *"That read would have applied the nib's invariant
to three modes that never swept one, silently."*

### 🔴 LEFT RED ON PURPOSE, and the reasoning is the good part

`assert-elbow` ROUTE-5/6/RES-2 and mode-rims' absolute-reach row **measure the right thing with a
round yardstick.**

> ⭐ *"The honest repair needs a known-bad built UNDER the nib and none exists — `syntheticElbow`
> builds at aspect 1, so a nib-aware branch would be **a branch no control exercises.** And I will not
> pin them either: **they are the only rows watching the shipped corner.**"*

---

# 🔴 CAN HE RAISE THE ASPECT? **NO — and this REPLACES F35's recommendation.**

| | 1.0 | **1.8 shipped** | 2.0 | 2.4 |
|---|---|---|---|---|
| elbow red rows | 0 | 9 | 9 | 10 |
| mode-rims red rows | 0 | 8 | **10** | **10** |
| ROUTE-5 short corners | 0.976 | 0.609 | 0.551 | 0.465 |
| **non-manifold edges** | **0** | **14** | **24** | **26** |
| `assert-nib-contrast` | red by design | **30/30** | 29/30 | **27/30** |

**At 2.0 a counter on desk-doodles closes to 21.5 % of itself. At 2.4 two of free stroke's seven
counters close outright** and **`BLEND-2` reads 0.02696 against its 0.03 bar, so the seam blend control
goes BLIND.**

> ⭐ **"F35 records 2.0 and 2.4 as measured and reachable. They are reachable and they cost a counter.
> 1.8 is the last setting where the nib gate is 30/30."**

**➜ F35 is superseded. The aspect dial stays at 1.8 and the case for moving it is closed by
measurement, not taste.**

### 🔴 F61 — `ROUTE-8` non-manifold edges: **0 / 14 / 24 / 26** at aspect 1.0 / 1.8 / 2.0 / 2.4

**A real defect that GROWS WITH THE ASPECT.** Mechanism: **the nib map is non-conformal, so a 90°
drawn corner enters field space at ~61.7° at aspect 1.8.** The loft folds harder on the sharper
corner, and the fold census bears it out: **6/415/10/369 at 1.8 against 101/42/107/52 at 1.0.**
⭐ *"Not an argument against the nib. Its remaining work."*

| # | side finding | note |
|---|---|---|
| **F62** | **`--loopEnds=capped` moves NOTHING on rod, extrude or solid** | Every number byte-identical to the shipped run: the flag goes through `setInflate`, so it only reaches Inflate. 🔴 **`CORNER_SPREAD_MAX`'s note claims "the parked capped seam breaks every one of them by 0.62". It does not.** Their 0.55 ceilings sit just above their *shipped* readings (rod 0.5042, extrude 0.5279), so **3 of 4 modes carry an ungated ceiling with a control that cannot move them.** |
| **F63** | **Two manifest citations stale by 5 lines** | `assert-elbow` cited :538 / actual :543; `assert-mode-rims` cited :514 / actual :519. **K3 tolerates both because it picks by token, so nothing is dark — but they are wrong.** ⭐ N10's token-primary change is why this is a note and not eleven dark channels. |
| **F64** | 🔴 **`assert-nib-contrast`'s manifest verdict has ROTTED** | It reads `"none"` with *"the file THROWS before it reaches any arm."* **It ran 30/30 green tonight with all five known-bads live**, and goes red by design at 1.0 and 2.4. **Needs re-ruling.** |

---

# 🔎 THE FULL PASSOVER — his instruction, run on a quiet tree after all fourteen lanes

**Not a summary. A re-measurement.** Every number below was taken just now, with **no lane running**.

## 1 · The tree

| | |
|---|---|
| **deleted files** | **0** — after a night whose lanes rewrote 49 evidence-wiping scripts and recaptured seven |
| **uncommitted SOURCE** | **0** |
| **every script parses** | **389 checked, 0 broken** |
| **`tsc`** | **exactly 6**, same six, same two files, both routes 200, fully swept |
| **commits since 01:00** | **120** |

## 2 · ⭐ F33 CLOSED — the meta-gate IS deterministic, and the drift was us

**Two consecutive runs on the quiet tree: 38 rows and 38 rows, and `diff` on the row sets is EMPTY.**

**The 54 / 53 / 52 / 51 drift measured earlier tonight was lanes writing to the tree.** ⚠️ And the one
run that read **39** was the run immediately after a commit — **the repo's own `post-commit` hook
rewrites `docs/STATUS.md`**, which moves a file the staleness rows read. **The instrument was never
the problem; the tree moving under it was.**

## 3 · The number that reframed everything, re-measured

# **54 → 38.**

`assert-gate-integrity` **CALIBRATED 41/41 across channels A-L**, and it says its verdicts are usable.
**Sixteen gates that could not report the failure they exist for, now can.**

## 4 · Every gate this night built or fixed

| gate | result |
|---|---|
| `assert-nib-contrast` | ⭐ **30/30 — BOTH FAMILIES ARE WRITTEN WITH A NIB** |
| `assert-stub-filter` | ⭐ **16/16 — THE TAPS ARE GONE AND SO IS THEIR CLOCK** |
| `assert-motion-paste` | 5/5 |
| `assert-fusion-combo-ui` | 14/14 |
| `assert-hero-options` | **SOUND** |
| `assert-letter-seam` | 20 rows, ALL PASS |
| `assert-drawin-attrs` | 19 rows, ALL PASS |
| `assert-carve-graze` | **RED — and N21 proved it red at aspect 1.0 too, so it predates the nib** |

## 5 · 🔴 WHAT THE PASSOVER CAUGHT THAT NO LANE DID

**`assert-fusion-combo-liveness` defaulted to `v1`, the PRE-FIX capture.**

N15 fixed the one dead cell, re-captured as `v2`, and reported **11 of 11 passing.** **A bare run read
`v1` and reported 3 failures** — about evidence that predated the fix by hours. ⭐ **Both statements
were true and only one was current.**

**Fixed `01ea4941`: the default is now DERIVED — the newest capture holding a `liveness.json` wins**,
and `--label=` still names one explicitly, so `v1` stays readable rather than deleted. **Proved both
ways: bare run 11/11 on v2; `--label=v1` still correctly reports its 3 failures.**

> ⭐ **That is the SEVENTH derived-value-frozen-into-a-literal of the night**, and the passover is the
> only thing that would have found it, because **each lane was right about its own half.**

## 6 · ⚠️ THE MODEL BATTERY WENT 39 GREEN → 35, AND THAT IS THE GUARDS WORKING

**15 red. Ten say `PROVENANCE`. Nine say `STALE`.**

🔴 **Read that carefully before calling it a regression.** Those are **N17's new freshness guards
refusing to grade evidence that predates the code**. Before tonight those gates **passed while grading
an 08-04 build.** ⭐ **`assert-screen-layers` printed `STALE BY 566.4h` and then 18 PASS rows about
08-04; it prints 0 now.**

> **Green went down because honesty went up. A gate that refuses is worth more than a gate that grades
> a build that no longer exists.**

⚠️ **And the treadmill N18 named is real and visible in this very run:** one gate reads
**`STALE BY 1.3h`** — staled by tonight's own commits. **Any `lib/` save re-stales every stored-capture
gate**, and the repo has no answer to that yet beyond re-capturing.

---

# ⏹ BRAND v2 — STRUCK. WRONG CHAT.

**Sebs, immediately after: _"Oh fuck wrong chat."_** The 1980s-sci-fi branding ask was meant for a
different conversation and has nothing to do with free-stroke.

**Backed out clean:** the empty `docs/brand-v2/` tree is removed, **no lane was ever dispatched**, and
**nothing outside this file was touched.** The section is struck rather than deleted so the record
shows what happened instead of leaving a phantom workstream a future reader would go looking for.

⚠️ **Nothing in this repo was changed for it.** The only cost was one commit and one empty directory.

---

# 🔬 CODEX CROSSCHECK — its verdict in one line

> # **"None of the six is fail-closed across its claimed subject."**

**80 of 80 emitted verdict assertions examined, denominator given without being chased.** ⭐ **And it
ran MUTATIONS rather than reading — every finding below names a break it made and the green it got.**
**This is the value a same-model check structurally cannot provide: the reasoning that wrote the gate
wrote the test.**

| # | file | the break that stayed GREEN | status |
|---|---|---|---|
| **1** | `assert-nib-contrast` | **aspect 1.8 → 1.6 = 30/30 exit 0.** angle 30° → 20° = **30/30 exit 0.** `CONTRAST_FLOOR` `:71` and `EXPECT_THIN_WORLD` `:73` **derive from the constants under test, so the bar moves with the defect.** | ✅ **FIXED `31/31`.** Verified at the line, then ratcheted: the shipped dial is now its own row. **Known-bad executed — forced to 1.6 it goes red and says why the others cannot.** |
| **5** | `evidence-swap` (**mine, 1 h old**) | **A SECOND interrupted commit deleted the recovery set.** End state `final=false, prev=false, staging=false` | ✅ **FIXED.** **Reproduced independently before believing it.** `commit()` now recovers before it destroys. **8th arm added.** |
| **2** | `assert-stub-filter` | Moving the sole `dropSubNibStubs: true` from the traced-word call to the **font** call → **16/16 exit 0.** The source check only **counts occurrences**; the measured subject separately forces `drop: true` | 🔴 **OPEN — F65** |
| **3** | `assert-motion-paste` | **Deleting a pasted export** → **5/5 exit 0.** Reconciliation walks only exports **still present** in the paste. ⭐ **Its `new key` control tests the OPPOSITE direction — an extra export, never an omitted one** | 🔴 **OPEN — F66.** ⚠️ N8 built this gate and it caught a real defect on its first run. **It is still half-blind.** |
| **4** | `assert-fusion-combo-liveness` | **Duplicating one cell over another kept 120 rows while LOSING a cell → 11/11 exit 0.** Removing fields printed **`mask NaN..NaN`** and **`undefinedx1816`** and still read **11/11** — *"the `<` and `> 0` comparisons let missing values pass"* | 🔴 **OPEN — F67.** ⭐ **Same NaN-passes-a-threshold defect N18 found in `assert-fusion-combo-distinct`, in a different file. It is a CLASS, not two incidents.** |
| **6** | `crash-row` | **`process.abort()` exits 134 with NO `[crash] FAIL` row.** A dedup mutant printed two red rows while the selftest still said `SOUND`, *"because `reds` is displayed but excluded from `ok`."* **And its selftest never parses `--selftest`, so channel L excludes it** | 🔴 **OPEN — F68.** ⚠️ **The guard built tonight to turn crashes into rows has a crash shape it cannot see, and its own selftest is unswept.** |

## ⭐ THE TWO THAT PROVE THE WHOLE EXERCISE

**Finding 5 was MY OWN FIX, ONE HOUR OLD.** I wrote a two-rename swap so a crash could not destroy
evidence, calibrated it with seven arms, watched them pass, and committed. **It worked exactly once.**
The second crash deleted the recovery set — **by the guard written to stop exactly that.**

> **A same-model check could not have found it, because the same reasoning that wrote the one-crash
> fix wrote the one-crash test.**

**Finding 1 is the sharper one.** `assert-nib-contrast` is the gate the whole nib rests on, it passes
30/30 with five known-bads, **and you could change the thing it grades and it would still pass.**
⭐ **Its rows were never wrong — they prove the mesh TRACKS the dial. Nothing guarded the dial.**

## What it said it could NOT check, unprompted

*"I did not rerun the browser fusion probe or recapture all 120 cells."* · *"I did not run either full
battery, so runner-level timeout and SIGKILL synthesis were not exercised end to end."* · *"The
evidence-swap test used real rename failures, not a literal power loss between filesystem
instructions."* · ⭐ *"**The mutations above prove specific blind paths. They do not exhaust every
possible way each subject could break.**"*

## And the visual, judged cold

Handed `AB-stubs-Dstem.png` with **no idea what it was supposed to be.** ⭐ **It cropped the image
itself with `ffmpeg` to look closer** — instrument behaviour, unprompted.

**It confirmed the fix independently:** *"a wide, flattened black lozenge … reads as stray geometry
rather than ink"* → *"the lozenge is gone."* **And it found two things I did not flag:**

- 🔴 **"A short spike still rises above the top stroke."**
- 🔴 **"The stem narrows sharply where it leaves the crossing, so the joint still feels pinched."**

*"I don't see anything clearly worse in the bottom half."* ➜ **F69: the spike and the pinch.**

---

# 🌙 WAVE 4 — close the crosscheck's findings

**His call: _"Close them."_** Rows before dispatch.

| # | lane | job |
|---|---|---|
| **C1** | **FAIL-CLOSED** | **F65-F68.** Four gates that pass while the thing they grade is broken. ⭐ **Each has a mutation Codex already RAN and the green it got — so every fix has its known-bad handed to it before it starts.** |
| **C2** | **THE SPIKE AND THE PINCH** | **F69.** Two defects a cold eye found in the shipped mark that nobody here flagged. |

⚠️ **C1's real risk is a lane that makes four gates fail-closed and breaks four working ones.** Every
fix must keep the existing rows passing, and **`assert-motion-paste` and `assert-nib-contrast` each
caught a REAL defect on their first run** — that power stays.

---

# 🔬 CODEX vs THE LANES — what each actually caught, measured off tonight's record

**His question: _"figure out what codex vs you."_** Not an opinion. **Here is the split, from the rows.**

## The pattern, in one line

> ⭐ **The lanes audited the INHERITANCE. Codex audited the DELIVERY.**

**Every one of Codex's six findings was in a gate written or heavily changed TONIGHT.** Not one was in
old code. **It went straight at the newest, most-confident, most-recently-proven work** — the exact
place a same-model check is weakest, because the confidence is shared.

## What the fourteen lanes found, and it was not weak

| what | how it was found |
|---|---|
| **The mark is a monoline** and the fix was specified and never built | looking at frames at 1×, then grepping `docs/research/` |
| **9 of 22 strokes shorter than the pen is wide** — 16.8 % of the clock | measuring the source against the nib |
| **`dist(A,B)=112.73`, `dist(B,A)=NaN`** — 554 of 3475 pairs could not fail | reading a distance function |
| **Channel G matched a word inside a gate's OWN control row**, invisible 24 days | running an already-red gate |
| **The meta-gate cited a paragraph ABOUT its control**, 1 487 lines away | a token-primary rewrite surfacing it **by construction** |
| **`for (a = d; a <= d; a += 0)`** — a 72-minute "slow" gate was an infinite loop | sampling the process instead of guessing |
| **101 of 103 gates turned a crash into no row** | walking the syntax tree and asking `rowRe()` |
| **The evidence-wipe class, 53 scripts** | grepping for one call shape |
| **5 queue rows opened against work that shipped 08-07** | checking tense in the code's own comments |

⭐ **That is deep work and most of it was found by MEASURING SOMETHING NOBODY HAD MEASURED.**

## What Codex found that fourteen lanes did not

| # | finding | why we were blind to it |
|---|---|---|
| **1** | **`assert-nib-contrast`'s floor DERIVES from the constant under test** — aspect 1.8→1.6 reads 30/30 | ⭐ **The gate's author and its reviewer shared the premise that the dial is the subject. Nobody asked what guards the dial.** |
| **5** | **My evidence-swap fix worked EXACTLY ONCE** | ⭐ **The same reasoning that wrote a one-crash fix wrote a one-crash test. Seven arms, all passing, all about the first crash.** |
| **2** | `assert-stub-filter` **counts occurrences** and cannot tell which call site | We knew the font path must not get the filter. **We wrote the gate knowing it, so we never tested that it knew it.** |
| **3** | `assert-motion-paste` sees an **extra** key, never a **missing** one | Its one control was built the direction its author was thinking in. |
| **4** | `assert-fusion-combo-liveness` — **`NaN` and `undefined` pass the comparisons** | ⭐ **N18 found this EXACT shape in a sibling file hours earlier. We fixed the instance and never looked for the class.** |
| **6** | `crash-row` cannot see `process.abort()`; **`reds` is excluded from `ok`** | The guard was proven on the crash shapes its author enumerated. |

## 🔴 THE MECHANISM, and it is not about skill

**Every miss above has the same shape: the known-bad was written by the same reasoning that wrote the
fix.**

- A one-crash fix gets a one-crash test.
- A floor derived from a constant gets a test that derives from the same constant.
- A gate written by someone who knows the font path must not be filtered never checks that the gate
  knows it.

> **The blind spot is not competence. It is SHARED PREMISES.** Fourteen lanes disagreed with each other
> constantly tonight — N20 removed N18's escape hatch, N18 owned it, N17 corrected channel F, N16
> corrected an explainer's ruling. **What none of them could do is doubt a premise they all held.**

## And the honest other half — what Codex could NOT have found

**It said so itself, unprompted:** *"I did not run either full battery."* · *"The mutations above prove
specific blind paths. They do not exhaust every possible way each subject could break."*

**And structurally, it could not have found:**
- **The monoline** — you have to know what the mark is *supposed* to look like.
- **"This was already fixed on 08-07"** — needs the repo's history and six weeks of journals.
- **Which of four films ships, or that 1.8 beats 2.4** — those are measured taste and closed rulings.
- ⭐ **It re-litigated NOTHING, because it was handed the closed list.** Without that it would have
  spent its budget reopening the aspect and the pen angle.

## The division that actually works

| | |
|---|---|
| **The lanes** | find what nobody has measured · carry six weeks of context · disagree with each other · **audit what they inherited** |
| **Codex** | **mutate what was just built** and watch for green · no memory of why anything felt true · **audit what was just delivered** |

**➜ Run it after a wave, pointed at the newest work, with the closed list attached.**
⚠️ **Not as a second opinion. As the only reader who does not share the premises.**

---

## ✅ CLOSING THE LOOP WITH THE FINDER'S OWN BREAK — the step that gets skipped, done

**I wrote into the skill that re-running the crosscheck's OWN mutation is the step nobody does, and
that on 2026-08-28 it had not been done. Doing it.**

⭐ **Why it is not the same as watching your own new arm go red:** **the arm was written by the fixer.**
The finder's break is the only test the fixer did not design, so it is the only one that proves **the
FINDING** is closed rather than a neighbouring defect.

### Finding 1 · `assert-nib-contrast` — both breaks re-run against the fixed tree

| Codex's mutation | it reported | **now** |
|---|---|---|
| aspect `1.8 → 1.6` | **30/30, exit 0** | 🔴 **FAIL** |
| angle `30° → 20°` | **30/30, exit 0** | 🔴 **FAIL, exit 1** |

**Row text on the red:** *"the SHIPPED dial is still the measured one — aspect 1.8, angle 30° —
**aspect 1.8, angle 20° — EVERY OTHER ROW IN THIS GATE DERIVES FROM THESE, so they moved with it and
cannot tell you.**"*

⚠️ **`lib/geometry-engines.ts` restored and confirmed byte-identical to git after each arm.**

### Finding 5 · `evidence-swap` — already re-run at fix time

Codex's break was *"a second interrupted commit with only `final.prev` remaining deleted that recovery
set first,"* end state `final=false, prev=false, staging=false`. **Reproduced independently before the
fix** (`prev: false — THE ONLY COPY IS GONE`) **and after** (`prev: true (3 files)`).

**➜ 2 of 6 findings are now closed against the finder's own break. The remaining 4 are with lane C1,
and its return must clear them the same way — not with its own arms alone.**

---

## ✅ C2 · THE SPIKE AND THE PINCH — both real, both PREDATE the nib, and one is a dead knob

### ⚠️ FIRST: the image Codex read is DESK-DOODLES, not free-stroke — proved numerically

The AB is a **5× nearest upscale**, and its bottom panel's spike is **50 rows of 5/10/15/20 px**, which
is the desk-doodles arm's **10 rows of 1/2/3/4 px exactly.** ⭐ **Free-stroke's own crop at that instant
carries NEITHER defect.** *(Established by arithmetic, not by eye.)*

### 🔴 THE SPIKE — not a stub, not the sweep. The `D` protruded past its own start.

**No tenth stub, and it is not close: the census ladder jumps 0.69 → 3.06 nib with nothing between**,
so every threshold in that gap drops the same nine.

**The `D` is drawn as a CLOSED LOOP.** Its ends are **6.58 px apart against an 8.47 px closure
threshold** — and `endpoint: "protrude"` pulls that to **26.15 px.** Rendered: **10 rows above the top
stroke, 1-4 px wide, against a 12 px stem.** Wobble contributes 0.7 px of the 19.6.

⭐ **It PREDATES the stub filter — the shipped AB's own BEFORE panel measures the same 10 rows.**
**The almond blob was sitting on top of it**, *"which is why a cold reader could see it and we could
not."*

**Three letters, not one:** the `D` and both `o`s of "Doodles" are closed in the trace, and protrude
opens all three — **6.58→26.15, 6.11→22.77, 1.73→29.99.**

### 🔴 THE PINCH — a defect, and the NIB PULLS THE OTHER WAY

Over the stretch where ink goes **5 px → 12 px (+140 %)**, the stem turns **1.91°** and the nib's own
half-width goes **1.1436 R → 1.1255 R, −1.6 %.** ⭐ **Second, independent control: at aspect 1.0 — a
perfectly round pen with no direction dependence at all — the pinch is still 5 → 11 px.**

**It is desk-doodles' UNBOUNDED TAPER.** Same tip fraction (0.159), same exponent (0.8), **only the
span differs**: free-stroke bounds it at `INFLATE_TAPER_SPAN_DIAMETERS = 0.7`;
`dd-engine/strokeTo3d.ts:1149` still runs `sin(πu)^0.8` over the **whole stroke.**
**On the `D`: 3.7 % of it under 90 % of full width on free-stroke, against 65.1 % of EVERY stroke on
desk-doodles.** ⭐ *"Free-stroke escapes by 6 units of luck, not design."*

| | ink | spike | stem at crossing / plateau |
|---|---|---|---|
| desk-doodles **1.8** | 28 569 | 10 rows | **5 / 12 px** |
| desk-doodles **1.0** | 27 477 | 10 rows | **5 / 11 px** |
| free-stroke 1.8 / 1.0 | 37 772 / 37 577 | none | 17 px flat |

**Both present at both aspects. Both predate tonight.** ⭐ **And the nib DOES now reach desk-doodles —
ink 28 569 → 27 477 — so F34's dead adapter is genuinely fixed and moves neither defect.**

### 🔴🔴 F70 — THE TENTH "ALREADY ON DISK", AND IT IS A DEAD KNOB

**`applyEndpointBehavior` in `lib/wobble-field.ts` ALREADY IMPLEMENTS the closed-loop branch** — a
radial push from the centroid instead of extending the two ends. **`HandFeelSettings.closed` is
declared and documented at `lib/stroke-processing.ts:64`, READ at `:324`** — **and set by nothing in
this repo.**

> ⭐ **Passing `closed: true` puts all three loops back under the threshold (7.65 / 7.52 / 4.58) with
> NO SOURCE EDITED, because the flag is already read.** The change is one predicate at `page.tsx`'s
> three `processStroke` call sites, **using the engine's own closure test.**

**F71 ·** `dd-engine/adapter.ts:425` computes `isClosedStroke` and passes it **only to the rod path**;
`buildInflateGeometry` takes no `closed` option and **never got free-stroke's bounded taper.**

⚠️ **Not settled, and it says so:** the fix is proved **on the centreline, offline**, through the real
`processStroke`. **Nobody has looked at a frame drawn with it**, because that needs an `app/` edit.

**Exit state:** `INFLATE_NIB_ASPECT_DEFAULT` back at 1.8, **SHA-256 `3259ad8c…` before the flip and
after the restore**, `lib/` `app/` `components/` clean, tsc 6, zero deletions. **One crop rectangle for
all four arms** — the union of all four bbox-anchored bands — *"the bands differ by 1-2 px between
arms, so per-arm cropping would have compared four different windows."*

---

## ✅ C1 · FAIL-CLOSED — all four closed, **every one cleared with the FINDER'S own break**

| # | the fix | Codex's mutation, re-run on the fixed tree |
|---|---|---|
| **F65** | The `font-exempt` row **counted occurrences**, so a MOVE kept the count at 1. It now asks the two **function bodies**, sliced by a brace matcher that blanks comments and string literals first **and fails closed if a body lacks the call it is about** | 🔴 **`STUB GATE FAILED, 16/17: font-exempt`, exit 1** — *with the detail line still reporting `1 occurrence(s) file-wide` beside it* |
| **F66** | ⭐ **Not a hand-list.** The expected inventory is read off **`toMotionMjsSource`, the generator the page's own Copy button calls** — so a constant added to the generator and never pasted is red **with no edit here** | 🔴 **`PASTE GATE FAILED, 6/7: complete`, exit 1 — with `resolved` and `agree` both still GREEN**, which is the measurement proving only the new row can see it |
| **F67** | Two rows run **before any threshold**: the cell set compared **as a set**, with duplicates named; and every number **present and finite**. Comparisons go through `atLeast()` / `above()` | 🔴 **(a) duplicate → SET row red, exit 1. (b) fields stripped → 4 of 15 red, exit 1** |
| **F68** | ⭐ **`process.abort()` is genuinely uncatchable in-process and it did NOT fake a fix** | see below |

### ⭐ F68 — it measured the uncatchable rather than shipping a row that looks like a fix

**On Node 25.6.1: SIGABRT arrives with the disposition already reset** — no `exit` event, no
`uncaughtException`, and **a `process.on("SIGABRT")` listener does not run either**, while
`process.kill(pid, "SIGABRT")` in the same file **IS** caught.

**So the runner backstop owns it — and it proved the backstop FIRES**, replicating `run-battery.mjs`'s
`run()` and its `guardMissedIt` predicate verbatim: an aborting gate returns **`code null / signal
SIGABRT`**, predicate true. **Positive control: a `throw` in the same harness returns code 1 with the
`[crash]` row and no backstop.** ⚠️ *"Codex's 134 is the shell's 128+6; Node's close event reports it
as `code null, signal SIGABRT`."*

**The two halves that WERE fixable:** the red-row count was printed and **excluded from `ok`**, so the
duplication mutant read **`SOUND` at `red-rows=2`** and now reads **`6 of 12 wrong. The guard is NOT
proved.`** And the file **parsed no `--selftest`**, so **channel L went 5 subjects to 6.**

### Nothing working was broken, and it showed it

Rows all passing: stub-filter **16→17** · motion-paste **5→7** · combo-liveness **11→15** · crash-row
selftest **11→12 cases**. **tsc exactly 6. Zero deletions.** Every mutated file **restored
byte-identical.**
⭐ **Meta-gate run twice, at HEAD and fixed, hour-noise normalised: 38 → 37. The single line that
changed is F67's channel D row, FAIL → PASS. Nothing new.**

---

## 🔴 F72 — THE CLASS COUNT: **10 sites in 4 gates**, and it read the other six rather than assuming

> **The shape is a FAILING set selected BY a threshold, so a missing or NaN value falls OUTSIDE it and
> the row passes.**

| gate | sites | state |
|---|---|---|
| `assert-fusion-combo-liveness` | 4 | ✅ closed here |
| `assert-fusion-combo-distinct` | 4 | ✅ closed by N18 |
| `assert-fusion-newborn:631` | 1 | 🟡 shape only — `markLuma` guards its own divide-by-zero |
| **`assert-fusion-combos:462`** | 1 | 🔴 **OPEN AND REACHABLE** |

**`combos:462`:** `worst = Math.max(...c.links.map(l => Math.abs(l.amount)))` is **`NaN`** for a link
with no `amount` and **`-Infinity`** for a cell with no links, **and `worst > ceiling` is false for
both — so a malformed cell passes the ceiling that exists to police it.**

⭐ **And it read the other six rather than assuming**, naming why each is safe: `authoring` has the
**safe polarity** (a NaN makes `moved` false and lands IN the failing set) · `two-dead` puts the
comparison **inside `say()`** at all six sites · `rail` gets **stricter** under a NaN · `ui`
null-guards its one counting site · `combo-ui` and `bundle-fresh` assert identities and counts.

**F73 · One residual N18's fix does not reach:** in `combo-distinct`, `nearest[].d` falls back to
**`Infinity`** when a cell has no comparable neighbour, and **a `loaded.get(k)` miss is skipped with no
row asserting the loaded set is complete.** ⭐ **That is the same count-instead-of-set hole F67(a) was.**

| # | for me | note |
|---|---|---|
| **F74** | **A stale ALLOW entry, and it is the list's own failure mode** | `control-manifest.json`'s `unswept` entry for `_probe-port-resolver.mjs` says channel L cannot see it. **N1 wired it in and L runs it every time now** (`PASS, 9 rows, exit 0`). ⭐ **The meta-gate only fails an unswept entry when the FILE is missing, so a wired-in-but-still-listed entry sits there silently.** |
| **F75** | Three K3 citations drifted (**pre-dating C1's change**), `--recite` moves them. And motion-paste's manifest `note` says *"Three known-bads"* where there are now four — **prose, not parsed.** |
| **F76** | `run-battery.mjs:1054` prints `ended at exit ${code}`, so an aborted gate reads **"ended at exit null"** rather than naming SIGABRT. **One word, and the only place the abort case surfaces.** |

---

# 🌙 WAVE 5 — what is actually left

**Rows before dispatch.**

| # | lane / owner | job |
|---|---|---|
| **D1** | **THE CLOSED LOOP** | **F70 + F71.** C2 proved `closed: true` puts all three loops under threshold **on the centreline, offline** — and ⭐ **nobody has drawn a frame with it.** Plus `buildInflateGeometry` never got free-stroke's bounded taper, which is the pinch. **This is the mark again, and it is the last visible defect anyone has named.** |
| **F64** | controller | `assert-nib-contrast`'s manifest verdict still reads `"none"` + *"the file THROWS"*. **It is 31/31 with five known-bads.** |
| **F74** | controller | The `unswept` ALLOW entry for `_probe-port-resolver.mjs` says channel L cannot see it. **N1 wired it in; L runs it every time.** ⭐ **The meta-gate only fails an unswept entry when the FILE is missing — so a wired-in-but-still-listed entry sits there silently. The ALLOW list's own failure mode.** |
| **F75** | controller | Three K3 citations drifted, pre-dating C1. `--recite` moves them. |
| **F76** | controller | `run-battery.mjs:1054` prints `ended at exit null` for an aborted gate instead of naming **SIGABRT** — one word, and the only place the abort case surfaces. |

**Still open and NOT taken tonight, stated so nobody thinks the list is empty:**
**F61** ROUTE-8's 14 non-manifold edges at 1.8 (the nib's remaining work) · **F62** three of four modes
carrying an ungated ceiling whose control cannot move them · **F72** `assert-fusion-combos:462` ·
**F73** `combo-distinct`'s `Infinity` fallback · **~37 gates** that still cannot report their own
failure · **two of N19's browser reds** with no explanation.

---

## ✅ THE FUSION CROP — class closed, cause named, and v2's green was partly fictional

**F72 closed** — `assert-fusion-combos:462` refuses a cell it cannot judge instead of passing it.
**34 rows**, calibration printing the two values that used to slip: **`Math.max reads NaN`** and
**`Math.max reads -Infinity`**. ⭐ **That is the tenth and last reachable site of the class C1 counted.**

**F73 checked rather than assumed** — two of its three named holes were already covered (`:191` asserts
every cell has a crop; the `refusedPairs` row catches the NaN path). **What was real is polarity:**
`best` starts at `Infinity`, `nearest` feeds the duplicate hunt, so **a cell the instrument could not
measure would read as the LEAST likely duplicate in the file.** One row asserts the shape and says in
the file that neither upstream path reproduces today.

### 🔴 THE CAUSE UNDERNEATH BOTH, and it was in the probe

`crop[0] * img.width`, **evaluated on every frame.** The fraction is constant; **the canvas is not.**
The box is resolved **once** now and a moved canvas is **refused**. ⚠️ **Three call sites were throwing
that refusal away, two without even assigning it** — wired into the `lost` mechanism the gate already
refuses on, rather than adding a second one.

### The measurement, before and after

| | geometries | pairs |
|---|---|---|
| **v1 / v2** (broken probe) | 108/12, then 98/22 | 🔴 **554 of 3475 REFUSED — 15.9 % of that gate's central question** |
| **v3** (fixed probe) | **112 at ONE geometry** | ✅ **3006 compared, 0 refused** |

**`assert-fusion-combo-distinct` went 4 failures → 1.** *"Every crop has the same geometry"* and
*"every authored pair could actually be compared"* are both green for the first time.

### ⚠️ AND THE HONEST HALF — v3 is REDDER, and that is correct

**Liveness read 11/11 on v2 and reads 3 of 15 on v3.** ⭐ **v2 looked cleaner because the broken probe
RECORDED a differently-framed picture instead of refusing one.** **9 cells are now named as unmeasured
rather than silently counted:**

- 🔴 **`layers+fusion` — `canvasMoved: 2968x1816 against the 1499x1816 this run's crop was resolved on`.**
  **The canvas DOUBLES IN WIDTH on that cell.** First time it has been named.
- **6 cells: `empty mask — the crop caught no mark`** — `material+animation+texture`,
  `material+animation+dither`, `material+texture+dither`, `material+animation+ascii`,
  `material+texture+ascii`, `material+dither+ascii`.
- **1 cell: `TypeError: Cannot read properties of undefined (reading 'capture')`** — the harness went.

| # | open | note |
|---|---|---|
| **F77** | 🔴 **The canvas resizes between fusion cells** — 1499→2968 wide | **App-side. The viewport is a flex child whose size follows the geometry mode's config strip** (found by N8, confirmed here by name). ⚠️ **Until it is pinned, one cell in 120 cannot be measured at all — and the probe can only refuse, not fix.** |
| **F78** | 🟡 **Six 3-way combos capture an EMPTY MASK** | The crop catches no mark. **All six start `material`/`animation`/`texture`.** Unexplained. |
| **F79** | ⚠️ **Pinning to the FIRST frame pins to whatever renders first** | v3 resolved on **1499x1816**, the geometry that was the MINORITY in v1 (12 of 120). **It refused only 1 cell here by luck of ordering.** ⭐ **The durable fix is F77; this pin is a guard, not a cure.** |

---

## ✅ F70 — THE SPIKE IS GONE, IN A PICTURE, ON BOTH FAMILIES. `fb35ad36`

⭐ **The fix wrote a knob that already existed.** `HandFeelSettings.closed` was declared, implemented
in `applyEndpointBehavior`, **read at `stroke-processing.ts:324`, and written by nothing.** It is
written now **from `closureStateOf` — the closure test the Desk Doodles engine already runs on these
strokes.** **No new constant. No letter named.**

| stroke | raw gap | shipped | after |
|---|---|---|---|
| `D` of Desk | 6.58 | **26.15 open** | **7.38 closed** |
| first `o` | 6.11 | **22.77 open** | **7.01 closed** |
| second `o` | 1.73 | **29.99 open** | **2.05 closed** |

Wrap bound **8.47 px**. **The other ten strokes are byte-identical to 0.01 px.**
**Needle rows above the bar: 10 → 0** desk-doodles · 6 → 1 free-stroke.

### 👁 CONTROLLER'S OWN EYE — `AB-Dstem.png`, four arms, one union crop each

**Confirmed, and it is unambiguous.** **desk-doodles BEFORE:** the stem crosses the bar like a **†**,
a clear needle standing above the horizontal. **AFTER:** gone — the stem meets the bar in a clean
corner. **free-stroke BEFORE:** a rounded **knob** lumped on the top-left shoulder. **AFTER:** clean.
⭐ **D1's description matches the picture exactly.**

### ⚠️ AND IT GOT THE MAGNITUDE WRONG FIRST — AND SAID SO

**The closed branch reached at the CALLER's ink scale: 4 px became 17.35 px, and it pushes EVERY
anchor** — nearly doubling both `o`s (**+84.8 %, +94.4 % area**) and faceting their counters.
**Kept as `AB-o1-dilation.png`, not deleted.** It runs at Desk Doodles' own calibrated amount now.
⭐ *"Nothing that ever rendered moved: it had never been reached."*

---

## ✅ F71 — AND CLOSING THE LOOP UNCOVERED A DEFECT UNDERNEATH IT. `a6782ffb`

🔴 **At 7 px apart, two ends tapered to 16 % width COULD NOT BRIDGE — and the desk-doodles `o`
rendered with its ring VISIBLY SPLIT.** The adapter now passes Inflate **the same `isClosedStroke` it
was already handing the rod path.** The ring is whole, and the `D`'s stem goes **6 px → 17 px** at the
crossing, flat 16-18 down, **against free-stroke's 17-18.** Free-stroke **byte-identical**: 38 925 px,
same bbox, same band inks.

> ⭐ **A fix that exposes the defect beneath it is the right kind of fix. The split ring was always
> there; the open loop was hiding it.**

### 🔴 NOT SHIPPED, AND THE REASON IS A NUMBER — **HIS CALL**

`taperSpanDiameters` is **built and gated**: thin fraction **65.4 % → 20.2 %**, landing on
free-stroke's 21.8 %. ⚠️ **It costs 24.8 % ink and turns `assert-nib-contrast`'s per-counter row RED on
desk-doodles — the `e` of "Doodles" falls from 33.0 % to 4.1 %** of what the round pen keeps.
**Measured both ways in one session.**

⭐ **And the choice is PINNED: `assert-taper-port.mjs` row F means adopting it turns a row red first.**
**A decision that cannot be taken silently.**

⚠️ **Still unfixed, plainly stated:** the **ten open strokes keep the unbounded taper** — visible as
**pointed, wire-thin ends** on the `e`, `s`, `k`, `l`, `d` in `AB-f71-word.png`.

### Controls watched go red, and nothing else moved

`assert-closed-loops.mjs` 13 rows — branch disabled on disk, live page re-read, **C1-C3 came back at
26.15 / 22.77 / 29.99, exit 1**, restored byte-identical with SHA matched. `assert-taper-port.mjs`
12 rows — two mutants, **bound off → 5 rows red at 65.4 %**, `closed` off → row C red, **row E: the
default is `sin(πu)^exp` BIT FOR BIT, worst delta 0.**

**Unmoved and checked:** stub-filter 17/17 · nib-contrast 31/31 · letter-seam 20/20 · hero-options
41/41 + 21/21 controls · handfeel · taper-envelope · joint-beading. **tsc 6. Zero deletions.**

| # | open | note |
|---|---|---|
| **F80** | 🔴 **`assert-hero-word-legible` expects 10 pieces; `letterCount` is 11** | Pre-existing, **not D1's** — the row reads only `logo-strokes.json` and `hero-motion.ts:1657`, neither in its diff. ⭐ **It is the stub filter's 11-letter map arriving at a gate nobody updated.** |

---

# 🌙 WAVE 6 — what is actually left, and one thing verified rather than trusted

⭐ **Verified myself before moving on:** C1 claimed Codex's F66 mutation now reddens. Deleting
`SHADOW_LAG_SEC` from the paste gives **`PASTE GATE FAILED — 6/7 rows: complete`**, where Codex got
**5/5 exit 0**. Tree restored byte-identical. **The claim holds.**

| # | lane / owner | job |
|---|---|---|
| **E1** | **THE CANVAS THAT MOVES** | **F77 + F78 + F79.** ⭐ **The root cause, and `app/` is free now that D1 has landed.** The viewport resizes between fusion cells — **1499 → 2968 wide** — so a fixed crop can only refuse, never measure. **Six 3-way combos also capture an EMPTY MASK and nobody knows why.** |
| **F80** | controller | `assert-hero-word-legible` expects **10 pieces**; `letterCount` is **11**. The stub filter's map arriving at a gate nobody updated. |

**Open and NOT taken, stated so the list is honest:** **F61** ROUTE-8's 14 non-manifold edges, growing
with aspect · **F62** three of four modes with an ungated ceiling whose control cannot move them, and
`CORNER_SPREAD_MAX`'s note making a claim that is false · **~38 gates** that still cannot report their
own failure (from 54) · **2 of N19's browser reds** with no explanation · **the ten open strokes'
unbounded taper**, which is inside his taper decision.

**His, and nothing moves without him:** which film ships (**four, not seven**) · `slowWeather`'s new
cell · the `holdOnEmpty` pill · **the taper span trade — 24.8 % ink against wire-thin ends.**
⭐ **The nib aspect is no longer his to weigh: N21 closed it by measurement. 1.8 is the last setting
where the nib gate is 30/30.**

---

## F81 — THE PEN'S TIP DRAWS ONE SHAPE, AND IT SHIPS SIX

**RE-MEASURED 2026-09-05 by lane G3, and one word of mine was too strong.**

I wrote "identical pixels". The right word is **indistinguishable**. At 55% of the draw, every mode
against the shipped `reed`, on a frame of **2,073,600 px**:

```
off 141 · cut 110 · nib 142 · quill 101 · chisel 83     floor 0 · positive control 9,127
```

**The largest gap is 0.007% of the frame.** Not byte-identical, and nothing a person could see. The
conclusion about the picker is unchanged and now survives a second measurement by a different lane
with its own instrument.

⚠ **AND THE TABLE HOLDS FIVE SHAPES, NOT SIX.** `off` and `cut` are the same shape under two names,
`{ nose: 0, taper: 0 }` byte for byte at `lib/pen-reveal.ts:840-841`. I noticed that this morning,
decided not to ship a picker over it, and never wrote it down. G3 found it independently.

**Opened 2026-09-04. NEEDS A FIX ON THE RENDER SIDE. Not a storage bug.**

`lib/pen-reveal.ts` exports `PEN_TIP_SHAPES` with six entries, a live setter with
its own subscriber set, a `useSyncExternalStore`-shaped subscription, a capture
harness hook, and a six-pill picker on `/desk-doodles` titled "The pen's tip".
**Every one of them draws the same pixels.**

### Measured, with both controls, before any claim

| arm | differing px (>8 grey levels) |
|---|---:|
| CONTROL, reed at playhead 0.35 vs 0.80 | **8,761** (the instrument sees) |
| CONTROL, reed at 0.35 twice | **0** (noise floor) |
| `/` Rod, nib vs quill | 0 |
| `/` Extrude, nib vs quill | 0 |
| `/` Solid, nib vs quill | 0 |
| `/` Inflate, nib vs quill | 0 |
| `/desk-doodles`, nib vs quill | 0, against its own control of **21,597** |

Ink counts differ per geometry mode (7,303 / 17,573 / 42,388 / 12,493), so the
mode switching worked and the frames are real.

### The gate was OPEN, so this is not "the tip was off"

`components/viewport-3d.tsx`, find by text:
`const wants = mode !== "off" && revealFrac !== null && !winNow.whole`

Measured in Inflate at playhead 0.45 through the app's own probe:
`revealFrac { frac: 0.446, window: { lo: 0, hi: 0.446, whole: false, empty: false } }`
All three conditions true.

### The cause, as far as it was chased

`__inflateProbe.drawDiag().tip` returns **null** in exactly that state, so
`penTipUniformsRef.current` is null and the tip's uniform block does not exist
on that render path. `tu.back` and `tu.taper` are the only two uniforms that
carry the shape, and nothing is there to write them to.

⚠ One precision worth keeping: all four SHIPPED shapes sit at `nose: 1`, so
`back` is 0 for every one of them and **`taper` is the only uniform that differs**.
If `tf.radiusArc` were 0 the taper would also be 0 for all four and the pictures
would match for a second, independent reason. That was NOT separated, because
the uniform block is null before either value can be read.

### Not done, on purpose

The document field `penTip` is built, coerced against `PEN_TIP_SHAPES` and
persisted (`lib/doc-store.ts`, `app/page.tsx`). **No pill was added.** A picker
offering six shapes that draw one shape is a control that lies, which is the
same class as the `inert` guard's *"a control that does the OPPOSITE of
nothing"*. The field carries the measurement in its own doc comment.

### Could not check
- Whether the lab's own picker ever worked, on any past commit. Not bisected.
- Whether `drawDiag()` reports the same material the frame is drawn with. The
  null is evidence the block is absent, not proof no other path writes a tip.
- A stylus, and any engine family other than the one the page loads with.

---

## ~~F82 — `orbitView`'s `fillK` LANDS NOWHERE~~ WITHDRAWN, 2026-09-04. IT WAS THE DEV SERVER.

**The bug was in the instrument, not the code, and the instrument was the dev server.**

F82 was opened on this evidence: fillK 1.0, 1.12 and 2.5 all produced byte-identical
frames, 24,829 ink px and a bottom edge of 0.998. That is exactly what a dev server
with a dead file watcher produces, and that is what was happening.

`fillK` works. Measured after restarting the server between edits:

| fillK | ink px | widest span | bottom edge |
|---|---:|---:|---:|
| 1.0 | 24,829 | 0.697 | 0.998 clipped |
| 1.25 | — | 0.614 | 0.998 clipped |
| 1.45 | — | 0.560 | 0.983 |
| 1.7 | 9,003 | 0.478 | 0.936 |
| 2.5 | 4,189 | 0.324 | too far out |

Shipped at **1.7**. `assert-camera-frames-the-drawing.mjs` is **8 of 8** on it.

---

## ~~F83 — THE DEV SERVER DOES NOT PICK UP FILE CHANGES~~ MOSTLY MINE. THE FLAG WAS WRONG.

**Withdrawn as written, 2026-09-04, and the correction is worth more than the row was.**

F83 said a freshly started dev server never sees an edit made after it starts.
That was measured honestly and it was true of every server I started, because I
started all of them with a flag that is not this project's:

    node ./node_modules/.bin/next dev --webpack -p 3105     <- what I ran
    "dev": "next dev"                                        <- package.json

`--webpack` came from a lane's note and I never checked it against `package.json`.
On this repo `next dev` is **Turbopack**. With the flag removed:

| | `--webpack` | plain `next dev` |
|---|---|---|
| token injected into a rendered string, then loaded | **absent** | **present** |
| `assert-geom-offthread` | `no page errors — SyntaxError: Invalid or unexpected token` | **ALL ASSERTIONS PASS** |

The SyntaxError was the implicit-surface Web Worker, built through
`new Worker(new URL("./implicit-surface.worker.ts", import.meta.url))`, which
the wrong bundler could not produce.

**WHAT THIS INVALIDATES, stated plainly.**
- The whole browser battery run of 2026-09-04 graded a wrongly-bundled server.
  30 of 58 gates judged, 11 red. **Those 11 are not findings.** Re-run.
- F82's fillK measurements were taken against a server that could not see the
  edit. That withdrawal stands, but its stated cause, "a dead watcher", is more
  precisely "a watcher I disabled with the wrong flag".

**WHAT SURVIVES.** The ORIGINAL server, pid 7765, was 9 days old and also failed
the token test before I had touched any flag. So a long-lived dev server here
can stop seeing edits. That is the real, smaller row, and it is below.

---

## F84 — A DEV SERVER LEFT UP FOR DAYS STOPS SEEING EDITS

**Opened 2026-09-04, out of F83's wreckage. Small, real, and cheap to avoid.**

pid 7765 had been up **9 days 3 hours**. A token injected into a rendered string
never appeared, and `find .next -newermt today` returned 0 files. Restarting it
with the correct command fixes it. Cause not chased.

**The rule that follows, and it cost a whole battery run to learn:**
start the dev server with the command in `package.json` and nothing else. If a
gate reports something structural about the app, check the server was started
correctly before believing it.

---

# 2026-09-04 · THE BATTERIES, RUN PROPERLY FOR THE FIRST TIME

**Everything below was measured on a server started with `next dev`, this project's own command.
The runs before that used `--webpack` and are void, which is F83.**

## Where the two batteries stand

| | start of day | now |
|---|---:|---:|
| model gates green | 36 / 51 | **44 / 51** |
| browser gates | never run this session | 58 run, **18 red**, 3 lanes on them |
| `assert-gate-integrity` | **NOT CALIBRATED, refusing to sweep** | **CALIBRATED 41/41 across A-L** |
| channel failures it can now see | invisible | 32 → **15** |
| gates with a negative control on the bare run | unknown | **103 of 111** |

## The five things that turned out to be instruments, not defects

1. **`--webpack`.** Mine, from a lane note. Breaks the implicit-surface Web Worker and hot reload.
   Invalidated 30 of 58 browser gates. **F83 withdrawn.**
2. **A bare `touch`.** Zero content change reddens every stored-evidence gate. 24 of 110 carry an
   mtime provenance row, 17 compare against `app/` or `components/`. The bumps were mine, from
   injecting a token into a source file and reverting it. Proven mtime-only at mean |Δ| **0.00000**
   across **382** frame pairs, against a control scoring 0.50741 on a real difference.
3. **Concurrent load.** A fusion capture on a shared server took **58 hot reloads in one 120-cell
   run and lost 9 cells**; alone, 0 and 0. It also produced two false reds on green gates.
4. **A skip detector reading its own control.** Fifth instance of prose read as code.
5. **Seven gates with no manifest entry**, six added by this session's own work, which is what had
   the meta-gate refusing to sweep.

## Real defects the staleness had been hiding

Re-shooting week-old evidence is where the findings were, not the re-shooting itself:

- `assert-timing`'s two `consecΔ NaN` rows were **missing frames**, not a broken measurement.
- `screen-layers` went from "the evidence is old" to naming **`rod/texture/fineGrain` under the
  perceptual floor** and **`motion/dit_pulse` as a one-shot that never stops**.
- `assert-hero-carve`'s `diffFrames` walked one index across two buffers and **never checked they
  were the same length**, so across a frame resize it returned "the same picture" in both
  directions. Calibrated: the gate as it shipped read 10/10 SOUND on that known-bad.
- `still-export`'s cube control **went blind**.

## Still open and still HIS

**F61** ROUTE-8's non-manifold edges, 0/14/24/26 by aspect · **F81** the pen ships six tips and
draws one · **F84** a dev server up for days stops seeing edits · `assert-layer-flicker`'s twelve
arms, which explainer 31 §4 already ruled **cannot** be fixed by a table entry and need a separate
gate, **a scoping call above the lane** · Completion Pulse, build or cut · which film ships · the
taper trade · the per-unit cascade and its 16-unit cap.

---

## F85 — `assert-drawin-pentip`'s PARKED-PRIOR CONTROL ENCODES THE ROUND-PEN WORLD, AND THE NIB CHANGED IT

**Opened 2026-09-04. The gate is RED and the red is CORRECT. Do not move the bar.**

The row is `CONTROL: the PARKED PRIOR still reads as a CUT`, wanting a pen score **< 0.5**, reading
**1.321**. Its stated job, in its own comment: *"If the arm captured with the tip shape OFF does not
read as a CUT, then either the fix is not what moved the number or the switch did not take."*

### The premise changed, and it changed on purpose

The picture is `docs/verification/pentip/parked-prior-then-now.png`, and it settles it by eye:

| | tip OFF, same word, same k values |
|---|---|
| **2026-08-03**, score 0.239 | every stroke ends in a **flat square chop** |
| **2026-09-04**, score 1.321 | every stroke ends in a **tapered wedge** |

**It is not the shader.** Lane C1 checked: at `off`, `wants` is false and `tu.on.value = 0`. The
taper is in the GEOMETRY the draw range walks.

**It is the broad nib**, which landed this month and is his. Measured by `assert-nib-contrast`,
which is green:

```
mono   (the round pen)  contrast 1.18   angle  2°
mirror (the broad nib)  contrast 1.77   angle 32°
```

`INFLATE_NIB_ANGLE_DEG_DEFAULT` is 30 and `INFLATE_NIB_ASPECT_DEFAULT` is 1.8. **A broad nib held at
30° cannot leave a square end.** So "tip OFF" no longer means "a cut", and the control's absolute bar
of 0.5 was derived in a world where the pen was a monoline.

### Why this is filed rather than fixed

- **Moving 0.5 deletes the only evidence the premise changed.** C1's words, and they are right.
- **Re-deriving it properly needs a round-pen arm** in this gate's own capture, at
  `nibAspect: 1.0`, so "cut" is measured where cut still means cut. `inflateResolveNib` already
  takes `nibAspect`, so the arm is buildable, but it is a new capture and a new calibration.
- The control's INTENT survives untouched and is worth preserving in whatever replaces it: prove
  the tip switch TOOK, and prove the tip is what moved the number rather than something else. The
  sibling row `the shipped tip is decisively nearer a NIB than the prior it replaces` already
  carries the second half.

### What C1 fixed on the way, which is why this row can be trusted at all

- **The fit was passing by accident.** The stroke-to-screen fit has four free parameters and
  searched two, taking its anchor from an ink-bbox midpoint that **two pixels** decide. A paper
  grid rule at x=1095 used to sit under the cut for all 2001 rows; the grid renders lighter now, so
  only rule CROSSINGS dip under, and one at (1083, 1829) moved the anchor **326 px**. `fitOnInk`
  went **97.3% → 0.5%**. Both translations are searched now: all four arms fit at 100.0%, 14 of 14
  known-bads still fail. ⭐ **F41 is the same pixel**, at (1094, 1820), luma 203.
- **The probe's default wrote evidence its own gate refuses.** 33 samples kept 3 playheads of 24
  where the row wants 8. At 201 it keeps 35/35/35/31, which is what every green capture this gate
  ever graded used. Default moved.
- **`assert-pentip-specks` had stopped being able to fail.** Breaking the `livePenTip` match on
  purpose made it print `source ships ? at nose ? / taper ?`, turn all 7 hard rows into COSTs, and
  **exit 0**. One condition added to the IDENTITY row, calibrated both ways.

### Could not check
- **Which commit made the parked prior taper.** Not bisected. The nib is the overwhelming
  candidate and the numbers above support it, but no bisect was run.

---

## F86 — THE EXPIRY POP IS `uFsDitThreshold`, AND THE ONE-LINE FIX WORKS. MY REFUTATION WAS WRONG.

**CORRECTED 2026-09-04 by lane E3. Everything below the line was my error and is kept as the record.**

**The channel is `d.uFsDitThreshold.value`.** The threshold-bias sweep sits at **-0.0990** below the
resting threshold at the cutoff and snaps to 0 in one frame. E3 bisected it one arm at a time, and
made "the edit was served" a VALUE on the report rather than a claim: the arm's name is published
from inside the frame loop and read back by the probe.

| arm | expiry | live tail | ratio | uniform steps across the interval |
|---|---:|---:|---:|---|
| shipped | **9.3875** | 0.9589 | **9.79x** | threshold **+0.0990**, intensity -0.0245 |
| `ditT.active &&` dropped | **0.9019** | 0.9580 | **0.94x** | threshold -0.0021, intensity -0.0245 |
| `ditT.amount` off intensity | 8.6680 | 0.8877 | 9.76x | threshold +0.0990, intensity 0.0000 |

**So C2 was right and I was wrong.** My A/B read 8.895 against 8.89 and I filed it as a refutation.
It cannot have reached the renderer. On the gate's own instrument the same change reads expiry
**7.836 → 1.279**, with rest 0 over 9 frames in both arms.

⚠ **And the "strongest fact" I wrote into this row is blind.** C2's non-static control was reported
as reading 0.0000 through the pulse and at expiry. Re-run at `diagonal` with a positive control
attached, it reads a live tail of **19.58**. A control that cannot see the thing it is controlling
for is not a control, which is the lesson this file keeps re-teaching.

### E3 shipped NO fix, and the reason is a real trade
The one-liner costs more than the pop. Parking the sweep leaves the layer RESTING at threshold
0.399 while the user's own control reads 0.500. Measured against the shipped resting frame that is
**Δ 10.24**, where the cross-run floor from two captures of the same code is **1.7552**. So the fix
removes a one-frame jolt and moves the resting state six times the noise floor away from what the
dial says.

A third arm, the sweep scaled by the pulse's own excess, rests at **1.7588**, i.e. ON the floor, and
brings expiry to 2.556 — but it changes how the preset MOVES, not just how it lands.

⭐ **That is a taste call and it is his.** Watched frame by frame in
`docs/verification/pulse-channel/expiry-three-arms.png`: the difference map rings every halftone dot
at once, which is a threshold step and not an intensity one.

---

### ~~The original row, kept because being wrong in public is the point of a ledger~~

**Opened 2026-09-04. A refuted hypothesis, recorded so nobody spends the same hour twice.**

Lane C2 isolated a jolt at the instant a `completionPulse` expires: on the densest-ink crop the
cell reads a live mean of **1.0918**, then **9.3637** at expiry, then **0.0000** for 29 frames. It
routed a fix to me, one condition in `components/viewport-3d.tsx`:

> the boolean gate discards the phase `evaluateLayerTime` deliberately parks at
> `PULSE_LIFETIME * speed` for exactly this reason

The line is `if (ditT.active && styleState.ditherDirection === "static")`, and the reasoning is
sound on its face. `LayerTime.active`'s own doc forbids that use in those words: *"Callers use it
for diagnostics and freeze handling — NOT to decide whether `amount` applies."* And
`evaluateLayerTime` really does park the phase rather than return to 0, saying *"returning to
phase 0 here snapped the pattern sideways at the exact moment the pulse was supposed to have
quietly finished."*

### It was tried and it changes nothing

Dropping `ditT.active &&` from that condition, with the dev server restarted between arms so the
edit was actually served:

| | `assert-screen-layers`, `motion/dit_pulse` |
|---|---|
| **without the change** | `it LANDS at Δ 8.895` |
| **with the change** | `it LANDS at Δ 8.89` |

**Reverted rather than shipped.** A change that moves a number by 0.005 is not a fix, and passing
it off as one would read as a decision.

### What that leaves

- The pop is **real and still there**, and it is C2's measurement that establishes it, not this row.
- `assert-screen-layers` PASSES the pulse anyway, correctly: it asserts the one-shot ENDS, and it
  does, `rest Δ 0 over 11 frames`. The landing magnitude is REPORTED, never barred. So no gate is
  currently red about this, which is its own small finding.
- **The threshold sweep is not the channel.** If it were, removing the gate would have moved the
  number. Candidates not yet separated: `d.uFsDitIntensity.value *= ditT.amount * gAmt`, which
  steps by `env * PULSE_SWELL` at the cutoff, and whatever else reads `ditT` in that block.
- C2's own control still stands and is the strongest fact here: with `ditherDirection` non-static
  the cell reads **0.0000 through the pulse AND at expiry**, so whatever pops only exists on the
  static path.

### Could not check
- Which uniform actually carries the step. Not bisected across the block's writes.
- Whether the pop is visible to the eye at 1x. It has only ever been measured, never watched.

---

## F86 ANSWERED (lane E3, 2026-09-04) - THE CHANNEL IS `uFsDitThreshold`, AND THE A/B ABOVE DID NOT MEASURE THE ARM IT NAMES

**The uniform is `d.uFsDitThreshold.value`.** The threshold-bias sweep sits at **-0.0990** below the
resting threshold at the cutoff and snaps to 0 in one frame. Everything else in the block steps by a
rounding error next to it.

Bisected in a lane copy on port 3133, one arm at a time, with the arm's name published from inside
the frame loop and read back by the probe, so "the edit was served" is a value on the report
(`armSeenInPage`) rather than a claim in a log. New probe:
`scripts/verify/_probe-pulse-channel.mjs`, 37 ms cadence, densest-ink crop at ink 0.364, the same
crop the capture uses.

| arm | expiry | live tail | ratio | uniform steps across the expiry interval |
|---|---|---|---|---|
| **shipped** | **9.3875** | 0.9589 | **9.79x** | threshold 0.4010 -> 0.5000 (**+0.0990**), intensity 1.0245 -> 1.0000 (-0.0245) |
| **`ditT.active &&` dropped** | **0.9019** | 0.9580 | **0.94x** | threshold -0.0021, intensity -0.0245 |
| **`ditT.amount` off the intensity** | 8.6680 | 0.8877 | 9.76x | threshold +0.0990, intensity 0.0000 |

Reading down the last column: kill the threshold step and the pop goes with it. Kill the intensity
step and 8.67 of the 9.39 is still there. **The intensity step is real and it is worth about 7% of
the landing.** `rest` is exactly 0.0000 over 24 intervals in all three arms, so no arm breaks the
one-shot's ending.

Same three arms on the gate's own instrument, `verify-screen-layers --only=motion --cells=dit_pulse`
then its `motion-report.json`: expiry **7.836** shipped, **1.279** with the gate dropped, rest 0 over
9 frames in both.

### The two claims above that do not survive

**1 - The recorded A/B.** F86 records dropping `ditT.active &&` as moving 8.895 to 8.89. Run here
with the arm proven live in the page, the same edit moves the gate's expiry from **7.836 to 1.279**
and the fine probe's from **9.3875 to 0.9019**. The edit in that arm cannot have reached the renderer
that shot those frames. **C2's diagnosis was right and the A/B that refuted it was the broken part.**

**2 - The non-static control, which is blind.** F86 calls it "the strongest fact here": with
`ditherDirection` non-static the cell reads 0.0000 through the pulse AND at expiry. Re-run at
`diagonal` with a positive control attached, the same cell reads a live tail of **19.58** and an
expiry of **8.18**. A crawling matrix moves a great deal. A control that reads 0.0000 while its
subject is provably animating is not a control (silent-degradation section 3), and the inference
drawn from it - that the intensity step is "worth nothing to the eye here" - was drawn from an arm
that could not see anything. The probe now refuses to report a rest window before it has proved, in
the same run and on the same crop, that the preset changes the crop at all (`dOffInk` 106.5 over a
0.364 mask) and that the crop moves during the live pulse (`liveMax`).

### Watched, not just measured

`docs/verification/pulse-channel/expiry-three-arms.png` is the four frames the pulse expires on for
each arm, with the difference across the expiry amplified 6x. On the shipped row every halftone dot
on the form is ringed in the difference map: they all change size in the same frame, which is what a
threshold-bias step looks like and what an intensity step of 2.4% does not.

### Why nothing shipped, and no bar added

**The one-line fix has a cost nobody had measured, and it is bigger than the pop.** Dropping the
boolean leaves the sweep parked at the phase where the envelope ended, which for this preset is
`sin(13.395 x 0.27) x 0.22 = -0.0990`. So the layer rests at threshold **0.399** while the user's
Threshold control reads **0.500**, forever. Measured against the shipped resting frame, 1.1 s after
the pulse is spent:

| | difference at rest |
|---|---|
| **CONTROL, shipped vs shipped, two separate captures** | **1.7552** |
| the `ditT.active` gate dropped | **10.2412** |
| the sweep scaled by the pulse envelope | 1.7588 |

**It trades a 7.836 one-frame pop for a 10.24 permanent offset**, on a mode whose own doc says it
"rests at normal otherwise" and on an `amount` whose doc says 1 means "the layer renders exactly as
its own controls say". A third arm keeps both: gate the sweep's amplitude on the pulse's own excess
(`(ditT.amount - 1) / PULSE_SWELL` when the sync mode is `completionPulse`, 1 otherwise) and drop the
boolean. Peak excursion is unchanged at 0.352, expiry falls to **2.556**, and it lands on 0.500 at
**1.7588**, which is the cross-run floor. Its cost is that the sweep now decays with the envelope
instead of oscillating at full amplitude the whole time, so the preset's live tail falls from 3.933
to 0.979. **That is a change to how a shipped preset moves, which is his call and not a lane's.**

**No bar added.** `assert-screen-layers` reports the landing and bars the ending, and the ending is
sound in every arm. A bar on the landing would redden the battery for a defect that is filed and
whose fix is a look decision that has not been made. The numbers to calibrate it with are in the
table above and in `docs/verification/pulse-channel/`.

### Could not check
- **Why the earlier A/B did not take.** Only that it did not. No copy of that arm's tree survives.
- **1x, on his screen, by eye.** Watched frame by frame at 6x amplification, which is how the dot
  ringing was seen. Not watched at speed in the app.
- **The other three static-direction presets.** `thresholdSweep` and `revealDither` run the same
  block but never reach the spent branch (`active` stays true in `independent` and `revealSynced`),
  so the step cannot occur there. Reasoned from the model, not measured.

---

## ~~F87~~ CLOSED 2026-09-04 by lane E1. `assert-fusion-authoring` 38 PASS · 0 FAIL.

**And I was wrong about the central claim.** F87 said the 0.12 "has no cited source. It is a
minimum invented in this file." **It had a source, on the mask the file had deleted.** Once the
metric is ink-masked it IS `diff-frames.mjs`'s `compare()`, line for line, and that file says at
:131 that meanΔ < 2 is below the perceptual floor on a dark surface. The sibling
`assert-fusion-two-dead.mjs` already grades `ACTS = 2.0` on the same basis.

⭐ **`0.12 × (1 / 0.049) = 2.4`.** It was that number all along, diluted by ONE composition's ink
fraction and then applied to twenty-one others. The bar was not chosen, it was **rejoined**:
FLOOR = 2.00, sitting between a loudest dead arm of **0.747** and a quietest live row of **2.139**.
`noise × 3` is kept and can only RAISE it.

### Three defects, not the two I filed
1. **The delta was `diff-frames.mjs` with its mask deleted.** The mark is 4.9% of the stage, so
   every number was the real one divided by twenty.
2. **The floor said "measured, not chosen" and was `max(0.12, 0)`.** Now cited.
3. 🔴 **The one I missed entirely: Part A's panel clicks WERE the composition Part B graded.**
   `BASE` promised a full reset and named **24 fields of 71**. Dumping `styleState` from the gate
   and from a cold probe on the byte-identical patch showed **ten fields disagreeing** — ditherType
   blueNoise vs bayer4, ditherLevels 3 vs 2, ditherIntensity 0.7 vs 1, and seven more. Creating a
   fusion BY CLICKING wakes its layers through the product's own preset path. `BASE` is seeded from
   `DEFAULT_STYLE_STATE` now and **read back**, all 71 fields checked standing where they were put.

### Four arms were asking their dial in the wrong register
Each against a rule this file had already written and applied to one arm out of three or four:

- **glyph dials read through two louder layers** — asciiCell 0.107 → **3.269**, asciiBite 0.190 → 2.139
- **asciiFlow asked of a constant source** — reveal 1.988 → breath **3.839**
- **three reflection dials asked of a ROD.** The sweep never sets a geometry mode, so it ran on the
  thinnest body the product has. sheen 1.488 → **6.226**, metal 1.707 → **7.126**, iridescence
  1.450 → **4.724** on `solid`. ⭐ `gloss` is the control: same dial, same factor of four
  (6.66 → 26.36), **so the whole family was at quarter strength and the three that failed were the
  three that could not survive it.** Not an area effect, the mask only grows 4.94% → 6.85%.
- **stackField's speed re-picked on the file's own criterion**, signal over its own neighbour:
  pulse@0.05 = 11.5x against the shipped pulse@0.1, now the worst at 1.8x.

**No bar was relaxed and no surface was edited.** Every change is to which pixels are averaged or
where the arm looks. Calibrated both ways: `--mutate=unlinked` turns all 21 targets and 10 sources
red at 0.00, and a new `--mutate=deadalive` reddens the known-dead row on 26 of 31.

⚠ **Thinnest margin: asciiBite at 7%**, 2.139 against 2.000, deterministic to three decimals on both
runs. It is the row that goes red first if anything about the glyph grid changes.

### The original row, kept because being wrong in public is the point of a ledger

### ~~F87 — `assert-fusion-authoring`'s FLOOR IS A HARDCODED NUMBER WEARING A MEASURED FLOOR'S CLOTHES~~

**Opened 2026-09-04. Diagnosed, NOT fixed, and the reason it is not fixed is stated.**

Two rows red, and every failing value sits just under one bar:

```
all 21 targets visibly change the render — ditherBite(0.08/0.12) asciiBite(0.06/0.12)
                                           textureAmount(0.10/0.12) textureScale(0.11/0.12)
                                           textureBite(0.09/0.12) sheen(0.0…)
all 10 sources carry a signal            — ditherField(0.09/0.12) textureField(0.10/0.12)
                                           stackField(0.06/0.12)
```

### Two defects, and the second one hides the first

**1 · The delta is diluted.** `frameDelta` ends `return sum / (w * h * 3)` — the WHOLE FRAME, paper
included. Fusion targets only ever touch the FORM. This is the identical defect C2 found in
`assert-screen-layers` and D2 confirmed in `assert-texture-relief`, both fixed today: there,
`dOff = dInk × inkFraction`, and Rod was being marked **3.7x harder than Inflate purely for being
thin**. ⭐ **This file already has `frameInkFrac` defined immediately below `frameDelta`** and uses
it only as a blank-frame guard, so the mask it needs is sitting there unused.

**2 · The floor does not do what its own comment says.** The comment is emphatic:

> *"THE FLOOR IS MEASURED, NOT CHOSEN. ... A hardcoded number would be a tuning that drifts with
> the frame rate, which is how a window sized for an old beat becomes a green row that cannot
> fail."*

And the code is `const FLOOR = Math.max(0.12, noise * 3)`. **This run measured `noise` at 0.000**,
so `noise * 3` is 0 and the floor is **entirely the hardcoded 0.12**. The measured half contributes
nothing. The file is describing a discipline it is not practising.

### Why this is filed rather than fixed

D2 could ink-mask `assert-texture-relief` and keep its bar, because that bar, 2.0, was **already
quoted from `diff-frames.mjs` as an ink-masked number** — the bar was right and the measurement was
wrong. Here the 0.12 has **no cited source**. It is a minimum invented in this file.

Ink-masking the delta scales every number up by `1 / inkFraction`, so the bar has to be re-derived
on the new scale, and **re-deriving it needs an arm known to be DEAD** to sit the bar between.
`assert-fusion-authoring` has none: it asserts all 21 targets and all 10 sources move, and
`deadTargets` is computed from the failures rather than from a control. **Picking a number without
one would be tuning, which is what the comment above warns against.**

### What the fix needs, in order
1. `meanAbsDiffInk` on this file, D2's shape: mask on "either frame has ink (alpha > 20)", return
   the mask SIZE, and **refuse by name on an empty mask** rather than falling back to the diluted
   number.
2. **A known-dead target arm**, so the new bar is derived rather than chosen. A fusion link with
   `amount: 0` is the obvious candidate and would mirror how D2 rebuilt `texture-relief` §2 as
   "the option present and dead".
3. Then the bar, set between dead and the weakest live target, and calibrated both ways.

### Could not check
- Whether ink-masking alone lifts all 21 above any sane bar. Not measured; the mask is not written.
- Whether `sheen` is dead for a different reason. It appears in the list with a truncated number.

---

## ~~F88~~ CLOSED 2026-09-04 by lane E2, commit `c6560e25`. `assert-export-window` 37 PASS · 0 FAIL.

**And my hypothesis was wrong, bisected rather than argued.** `dropSubNibStubs` is NOT what moved it: this gate's
fixture is TWO MOUSE STROKES (`__revealHarness.schedule()` reads `strokeCount: 2, unitCount: 2`), and the filter
appears exactly once in the app, in `app/desk-doodles/page.tsx`, **a route this gate never loads**. The 22-to-13
story is real for the traced word and irrelevant here.

**The mark spans 319 px of a 798 px film, 40.0% of the width.** `inkCentroidX` divides by the RASTER width, so a
bar of 0.15 in frame units was asking a mark that occupies 40% of the page to cross 15% of a page it does not
occupy. Same class as the 20,000 against a 4,963 px mark in the sibling row, and the same reason the relative
`blank` never needed touching.

⭐ **And opening the frames beat the arithmetic.** At `overlap: 1` both strokes draw AT ONCE, so a reordered
centroid is a mean over two strokes and lands near the finished mark's centre. **It can never reach "the other
end". The row was asking for a displacement the schedule cannot produce.**

The bar is derived now: `carried(c) = (c - ci) / (cFull - ci)`, how far the reordered film has carried its ink
toward where all the ink ends up, over the travel the identity film has left. Two horizontal distances on the same
mark, so a camera that reframes moves both. Bar 0.5, and it is flat across the draw (0.734 / 0.749 / 0.765 / 0.786
/ 0.749), which is what makes it a statistic rather than a reading. Calibrated on a REAL injected defect,
`buildStrokeSchedule` forced to ignore its params: carried 0.000, IoU 1.0000, RED.

### The original row, kept because the diagnosis is still the record

### ~~F88 — `assert-export-window` Q1: THE PICTURE IS REORDERED, THE CENTROID PROXY IS NOT~~

**Opened 2026-09-04. One row red, diagnosed, deliberately not fixed. Its sibling row IS fixed.**

```
Q1 · the REORDER is IN the film — early ink sits at the other end of the page
     frame 12/44: ink centroid x  scheduled 0.466 vs identity 0.376 (Δ 0.091)
                  IoU 0.2597 · ink 2092 vs 1991 px
```

The assertion is `Math.abs(cs - ci) > 0.15 && iou(ms, mi) < 0.35`.

**The IoU half passes decisively: 0.2597 against a 0.35 ceiling.** The two frames share barely a
quarter of their ink. The reorder is unmistakably in the film. **The centroid half fails at 0.091
against a hardcoded 0.15.**

### Why the proxy stopped working, most likely

`dropSubNibStubs` landed 2026-08-28 and cut the traced word from **22 polylines to 13**. Lane D1
found the same filter reddening three separate gates today, including a known-bad named *"all 22
contacts"* that now publishes **8**. A shorter word occupies less width, so reordering it moves the
ink centroid less, while leaving the masks just as disjoint. The 0.15 was chosen when the word had
22 strokes.

⚠ **Stated as the leading hypothesis, not a measurement.** Nothing was bisected and the word's
horizontal extent before and after the filter was not measured.

### Why it is not fixed here
Dropping the centroid condition would leave the row resting on IoU alone, which is a real claim but
a weaker row than the one that was written. Re-deriving the bar honestly means deriving it from the
mark's own horizontal extent, so that "moved to the other end of the page" scales with how long the
page's mark actually is. That is a small piece of work and it wants a measurement of the extent
first.

### The sibling row IS fixed, same file, same class
`the films really do end where the model says` was failing on a hardcoded **20000** ink count while
all three films were behaving exactly as the model names: vanish decays from its peak to 22 px
BLANK, grow forward rises to its peak on the mark, grow+reverse ends blank. **This mark peaks at
4,963 px.** The films were right and the ruler was sized for a bigger fixture.

Both arms are derived now:
- `cf.peak > Math.max(cv.lastInk, cr.lastInk) * 10` — the mark must dwarf the blank tails the other
  two films end on. Measured 4,963 against 220, a 22x margin.
- the control, which must read FALSE, is `cv.peak < cf.peak * 0.5` — both films show the SAME mark,
  so a Vanish that really starts with the whole mark peaks where Grow peaks. Measured 4,963 against
  a 2,481 threshold, so it reads false and the control holds.

`blank` two hundred lines above was already relative, `lastInk <= peak * 0.10`, which is why the
shape half of that row kept working while only the magnitude half was absolute.

### Could not check
- **No mutant was injected for the films row.** The calibration rests on the two margins above, 22x
  and 2x, not on an arm forced to fail.
- The word's extent before and after `dropSubNibStubs`.

---

## F89 — A PAIRED CONTROL THAT IS THE COMPLEMENT OF ITS OWN SUBJECT IS NOT A CONTROL

**Opened 2026-09-04 out of E2's work. One instance FIXED, one FLAGGED, and the shape is worth hunting.**

`assert-export-window`'s Q1 asserted `Math.abs(cs - ci) > 0.15` and paired it with a control reading
`Math.abs(cs - ci) <= 0.15`. **That is the exact complement of the subject**, so it could never fire
independently and the pair collapsed to a bare `if`. A control that is `!subject` tests nothing: it
is guaranteed to answer the moment the subject does, and it answers with the same fact.

E2 replaced it with one that can disagree: the identity film compared at the frame where it carries
the **same amount of ink**, which removes "there is simply more ink" as the explanation. It reads
carried 0.065, IoU 0.890, and is false on both terms.

⚠ **Q2 in the same file has the same smell and was NOT investigated.** Under E2's injected mutant it
read `real=true control=true`, which is what a degenerate pair looks like. It is green on every
healthy run, so this is a shape to check rather than a failure to fix.

**Worth a sweep.** `assert-gate-integrity` already holds "does this gate have a control" and "does
the control still reject its known-bad". It does not hold **"is the control merely the negation of
the subject"**, and that is a control which passes every existing check while proving nothing.

---

## F90 — 70 OF 124 SOURCE FILES HAD AN MTIME AHEAD OF THEIR OWN CONTENT. REPAIRED.

**2026-09-04. Not a code change, and it took four gates from red to green at once.**

Lane C3 found the mechanism this morning: **a bare `touch` reddens every stored-evidence gate with
no content change at all.** 24 of 110 `assert-*.mjs` carry an mtime provenance row and 17 compare
against `app/` or `components/`, so one write to one shared file reddens seventeen gates. C3 proved
its own three were mtime-only at mean |Δ| **0.00000** across **382** frame pairs, against a control
scoring 0.50741 on a real code difference.

**I then did it to myself three times**, because `git stash`, `git stash pop` and
`git checkout -- <file>` all restore the CONTENT and move the MTIME. Trying a fix and reverting it
is the most ordinary thing a session does, and it silently invalidates every stored capture.

### Measured on this tree, with nothing dirty

```
tracked files under lib/ app/ components/     124
dirty                                           0
mtime AHEAD of its own last content change     70
```

Zero dirty means all 70 had content identical to HEAD. **Their mtimes were describing a history
that did not happen.**

### The repair, and why it is strictly correct

For every tracked file whose content is exactly HEAD, set its mtime to the commit date of the last
commit that actually CHANGED it. Git does not store mtimes, so this is a known technique and
`git status` is unaffected, measured 0 dirty before and after.

It cannot hide a real defect. The only case it touches is *mtime newer than the content's own
commit, with content identical to HEAD*, which is exactly "touched, not changed". A file whose
content genuinely changed at commit T keeps mtime T, so a capture taken before T still reddens.
**Noise removed, signal kept.**

### What it bought, immediately

| gate | before | after |
|---|---|---|
| `assert-form-orbit` | PROVENANCE, red | **exit 0** |
| `assert-gloss-rim` | PROVENANCE, red | **exit 0** |
| `assert-hero-carve` | PROVENANCE, red | **exit 0** |
| `assert-timing-frames` | PROVENANCE, red | **exit 0** |

Four gates, no code change, no re-capture. Re-shooting would have produced byte-identical frames,
which is what C3's 0.00000 already said.

### What is still not solved
`_capture-freshness.mjs` decides on `statSync().mtimeMs` and says, correctly, *"THE FIX IS NEVER TO
LOWER THIS."* It has no way to tell a touch from a change. **A content hash would answer the
question directly instead of by proxy**, and would make this repair unnecessary rather than
periodic. That is a design change to a load-bearing module and it is not one to make at the end of
a long day.

⭐ **Until then the rule is: never `git stash` or `git checkout --` a file under `lib/ app/
components/` in the main checkout. Experiment in a copy under `~/.fs-lanes/`.** It is now in
`HANDOFF.json`'s must_not and in all three E-lane briefs.

---

## F91 — `assert-mode-rims` RUN AT LAST (7 RED), AND THE NIB DIAGNOSIS CONFIRMED BY DRIVING THE DIAL INSTEAD OF EDITING HIS CONSTANT

**Lane E3, 2026-09-04.** Two jobs that turned out to be one cause.

### `assert-mode-rims`, which nobody had run

**183 PASS · 7 FAIL · exit 1.** Every one of the seven is on `inflate`, and none is on rod, extrude
or solid:

```
circle/inflate    wall creases are PLACES, not a ladder      2 expected, 0 found
circle/inflate    the rim is not a chain of cuts             1 expected, 0 found
square/inflate    wall creases are PLACES, not a ladder      4 expected, 16 in 3 places
square/inflate    cap-to-wall edge is rolled, not die-cut    mixed max 85.55
square/inflate    drawn corners still REACH                  rho_out/r 1.036 0.6085 1.029 0.6112
tick/inflate      wall creases are PLACES, not a ladder      2 expected, 18 in 3 places
openArc/inflate   wall creases are PLACES, not a ladder      0 expected, 8 in 2 places
```

That is F59's count minus the one row N21 repaired, and the corner reading is `assert-elbow`'s
`[seam 1.036 0.609 1.029 0.611]` to four decimals. **Same defect, two gates.**

### The dial is now driveable, and the drive is proven rather than assumed

N21 attributed all of this by flipping `INFLATE_NIB_ASPECT_DEFAULT` in `lib/geometry-engines.ts`,
which is a source edit on one of his constants. `nibAspect` is a real `InflateParams` field and
`__styleHarness.setInflate` reaches it, so both gates now carry an **opt-in** `FS_NIB_ASPECT` arm.
Driven, on today's tree, nothing edited:

| | 1.0 | **1.8 shipped** | 2.0 | 2.4 |
|---|---|---|---|---|
| `assert-elbow` red rows | **0** of 40 | **9** | 9 | 10 |
| `assert-mode-rims` red rows | **0** of 190 | **7** | not run | not run |
| ROUTE-5 corners | 1.000 0.976 0.973 0.978 | 1.036 0.609 1.029 0.611 | 1.029 0.551 1.032 0.554 | 0.998 0.465 1.014 0.466 |
| ROUTE-8 non-manifold | **0** | **14** | **24** | **26** |

⭐ **All sixteen ROUTE-5 readings are identical to three decimals to the literals N21 typed into
`predict-corner-reach.mjs` on 2026-08-28.** That matters more than it looks: those literals are a
hardcoded MEASURED table, so the closed form's 0.036 residual would still print if the gate had
drifted underneath it. It has not. And the numbers came from a `setInflate` patch rather than from
flipping the constant, so **the two routes agree and the dial is a validating driver.**

### D2's diagnosis: CONFIRMED, with one thing said more precisely

Eight of the nine are round-pen predicates reading an elliptical nib, and every one of them goes
green when the pen is made round. ⚠ **But the closed form covers TWO of the eight, not eight.**
`predict-corner-reach.mjs` predicts the 16 ROUTE-5 corner readings, which is ROUTE-5 and its `r7`
twin RES-2. ROUTE-6, BLEND-3a, the three BLEND-3b rows and BLEND-3d are classified by the same
MECHANISM and by going green at aspect 1.0. **No closed form predicts their numbers**, and the row
should not be read as saying one does.

**A second, independent channel says the same thing.** The gate's own `nibContrastBuilt` — max/min
half-width over the drawing's arc-length-weighted direction census — reads **1.4703 at a dial of
2.0** and **1.5725 at 2.4** on the square. The drawing receives far less contrast than the dial asks
for, for the identical reason the corner reading is 1.70 and not 1.80: **a square travels in two
directions and neither is on the ellipse's axes at a 30 degree pen.** That is the ray cast's
finding arriving through the width census, which shares none of its arithmetic.

### ROUTE-8 is F61 and was not attempted

Its numbers are reproduced above and nothing else was done to it. **It is the one row aspect 1.0
does not exonerate**, because 0 non-manifold edges at 1.0 is not a measurement artefact going away,
it is a topological defect that scales with the aspect.

### `_probe-elbow-nib.mjs` is finished, and it KILLS the claim it was written to test

The untested claim was *"`__inflateProbe.debug().nibAspect` reads the PRODUCED value back, which
would make a validating driver."* **It does not.** `INFLATE_DEBUG.nibAspect = build.nib.aspect`,
and `build.nib` is `inflateResolveNib(params)` — the resolver's echo of the request.
`lib/geometry-engines.ts` says so itself four lines above the field: *"REQUESTED and PRODUCED are
separate rows on purpose."* The produced value is **`nibContrastBuilt`**.

The probe's must-fail arm is the proof, and it fires: on a **straight line** the dial reads **2.4**
while the built census reads **1.000**, on the same page, in the same run, with nothing broken. A
one-direction drawing has one half-width, so it genuinely cannot tell — which means the FIXTURE is
half the instrument, and a driver validated on `debug().nibAspect` would have reported success for a
nib that never touched a vertex. The probe also prints the arm that DOES separate: a circle, where
the census climbs 1.000 / 1.400 / 1.800 / 2.400 against dials of 1.0 / 1.4 / 1.8 / 2.4.

⚠ It also carries a note that `debug().fieldBaseRadius` reads **0** on this path and is not a
measurement of anything: `geometry-engines.ts` writes it only on the implicit-surface build.

### What landed, and how it is calibrated

`FS_NIB_ASPECT` on `assert-elbow` and `assert-mode-rims`. **Unset, both files are byte-identical
runs** — proven by diff: `assert-elbow` 40 rows, `assert-mode-rims` 190 rows, the ONLY differing
line in either is the PROVENANCE timestamp. **A diagnostic run exits 2 whatever its rows do**, and
writes to its own label, so an all-green run at aspect 1.0 can never be quoted as the gate passing.
Both new refusals were calibrated with an EXECUTED known-bad, not a quoted one:

| known-bad | what fired |
|---|---|
| the drive sends `setInflate({})` instead of the aspect | `the driven nib did not survive arm loft — asked 1, the resolver reports 1.8` |
| `FS_NIB_ASPECT=0.5`, which `inflateResolveNib` would silently reject and replace with the default | `FAIL FS_NIB_ASPECT=0.5 is not a nib aspect (finite, >= 1)` |

### Could not check
- **The produced-value guard firing inside these two gates.** Both draw a square, whose census reads
  1.4703 at a dial of 2.0 — dial and produced disagree in MAGNITUDE but both clear the guard, so the
  square cannot separate them. The separation is executed in `_probe-elbow-nib.mjs` arm B and is
  quoted above; inside the gates that row is a tripwire that has not been shown to fire on this
  fixture.
- **`assert-mode-rims` at 2.0 and 2.4.** Only 1.0 and the shipped 1.8 were run. F59's 10 / 10 stands
  as N21 measured it, not as re-measured here.
- **Whether the six non-corner rows could be given a closed form.** Not attempted.
- **`--recite`.** My two inserts pushed the manifest's cited lines further out of date
  (`assert-elbow` :543 -> :597, `assert-mode-rims` :519 -> :541). The meta-gate calls this
  **advisory, not a failure**, and 12 other gates carry the same drift, so the fix is one `--recite`
  across all 14 and that touches other lanes' files. Left for whoever owns the sweep.

---

## F91 — THE NIB IS NOW THE SINGLE LARGEST SOURCE OF RED GATES, AND EVERY ONE OF THEM IS HIS PICK

**2026-09-04. Lane E3 drove the aspect through `setInflate` and the whole table fell out at once.**

Three gates, one cause. Driving `nibAspect` rather than editing his constant:

| gate | at aspect 1.0 | at the shipped 1.8 |
|---|---|---|
| `assert-mode-rims` | **190 PASS · 0 FAIL** | 183 PASS · **7 FAIL**, all seven on `inflate`, none on rod/extrude/solid |
| `assert-elbow` | **0 red** | **9 red** |
| `assert-elbow` non-manifold edges | **0** | **14** (and 24 at 2.0, 26 at 2.4) |
| `assert-drawin-pentip` | the parked prior reads as a CUT | **1.321**, a tapered wedge (F85) |

⭐ **N21's whole table reproduced without touching `INFLATE_NIB_ASPECT_DEFAULT`**, and all sixteen
ROUTE-5 readings match `predict-corner-reach.mjs`'s literals to three decimals.

**A correction to D2's diagnosis, which E3 checked rather than inherited.** D2 said eight of the
nine elbow reds were round-pen predicates measuring an elliptical nib. The closed form covers
**two** of them, ROUTE-5 and RES-2. ROUTE-6 and the four BLEND-3 rows are classified by mechanism
and by going green at 1.0 — same conclusion, weaker evidence than "the formula predicts it", and
worth the distinction. ROUTE-8 is **F61** and was not attempted.

### The probe killed the claim it was written to test
D2 left `_probe-elbow-nib.mjs` untracked with the hypothesis that
`__inflateProbe.debug().nibAspect` reads the PRODUCED value back and would make a validating driver.
**It does not.** That field is `inflateResolveNib`'s echo of the REQUEST. The produced value is
`nibContrastBuilt`. The probe's must-fail arm fires: on a straight line the dial reads **2.4** while
the census reads **1.000**, because a straight line has no corner for the nib to widen.

New corroboration from a channel that shares no arithmetic with the ray cast: on the square the
census reads **1.4703** at a dial of 2.0, for the same reason the corner reads 1.70 and not 1.80.

### What this means for the ledger
**Nothing here is a defect to fix and everything here is one decision.** The nib landed this month,
deliberately, and it is his. These gates encode the round-pen world they were written in. The
options are the same three every time: re-derive each control against the nib, park the nib, or
accept the reds as the record of a deliberate change.

`FS_NIB_ASPECT` is now an opt-in arm on both gates and exits 2 by construction. **Unset, both gates
are byte-identical to before** across 40 and 190 rows, only the PROVENANCE timestamp differing. Both
new refusals were calibrated with executed known-bads.

### 2026-09-22 update: the 14 are not the nib. They are marching cubes, and the fix is in a file this lane did not own

**Measured by `scripts/verify/_probe-nib-manifold.mjs`, nothing in `lib/` edited.** Output kept at
the lane's scratchpad, numbers copied here.

| square, `fusion: auto` | 1.0 | **1.8** | 2.0 | 2.4 |
|---|---|---|---|---|
| ROUTE-8 census (`probeDihedral`, welds positions at 1e-5) | 0 | **14** | 24 | 26 |
| the polygoniser's own audit, by INDEX (`meshNonManifoldEdges`) | 0 | **0** | 0 | 0 |
| the probe's census, by index | 0 | **0** | 0 | 0 |
| triangles that collapse when the census welds | 0 | **14** | 24 | 26 |
| `nibContrastBuilt` | 1.0000 | 1.4046 | 1.4703 | 1.5725 |

**The mechanism.** The mesh is manifold by index at every aspect. The census welds vertices that
round to the same 1e-5 key, and marching cubes emits distinct vertices **1.7e-6 to 9.5e-6 apart**
when a grid sample lands almost exactly on the surface: every crossed edge from that grid corner
gets a vertex at t near 0, so two or three of them sit on top of each other. Welding them folds a
sliver triangle to a line, and the edges around it land in 4 triangles each. **The count of
non-manifold edges equals the count of collapsed triangles on all four arms.** The sites are on
the walls, 4.5 to 14.6 radii from the nearest drawn corner, so F61's "the loft folds harder at the
sharper corner" is not what this row measures.

**Why 1.0 reads 0.** Luck of alignment. At 1.0 the square's walls run parallel to the grid, so the
crossing t is nearly constant along each wall and never nears a grid corner. Under the nib the
field-space square is sheared, its walls cut the grid obliquely, and t sweeps through every value
including those within 1e-3 of a corner. ⭐ **The control that settles it:** the same square turned
20 degrees at **aspect 1.0, round pen, reads 14**, the same as the shipped nib (18 at 1.8 turned).
Positive control: one planted fold on the 1.0 mesh moves the census 0 to 1, so its 0 can see.

**What this means for the decision.** The nib is innocent and must not be re-derived or parked for
this row. Any drawing whose walls are oblique to the grid, which is every real word, carries the
same micro-slivers at any aspect. Index topology is closed, so a GLB exports manifold; a tool that
merges by distance (Blender's default 1e-4, most slicers) welds them and gets the non-manifold
edges. It is a real defect, and it lives in the polygoniser.

**The fix, not applied.** `lib/implicit-surface.ts` in the marching-cubes vertex placement clamps
t to [0, 1]. Clamping it to about [0.01, 0.99] keeps any two vertices at least ~1e-4 apart, which
the 1e-5 weld can never merge, moves no vertex more than 0.01 of a cell (1e-4 world units, about
1/30000 of the canvas), and changes no topology. That file is shared by the inflate field only
(importers: `geometry-engines.ts`, `implicit-defer.ts`, the worker), so rod, extrude and solid are
out of its reach, but it was outside this lane's ownership and was not touched. A post-pass in
`geometry-engines.ts` was considered and rejected: it would need the grid origin, which only the
polygoniser knows, and patching the output instead of the placement is fixing the surface, not
the cause.

**Not checked:** the clamp itself, in any build. Whether the other eight elbow reds and the seven
mode-rims reds move with it (they should not: they are round-pen predicates, and none reads the
weld). A GLB round trip through a real importer. `assert-mode-rims` and `assert-drawin-pentip`
baselines were run today (7 red and 1 red, the same rows F91 lists) so the after-run has a floor.

### 2026-09-22, later: FIXED. The clamp the lane proposed was wrong, and the gates caught it

**Landed in `lib/implicit-surface.ts`: a grid sample within 0.1% of a cell of the surface is pushed
off it, sign kept.** Non-manifold now reads **0 at 1.0, 1.8, 2.0 and 2.4**, on the square and on the
turned square, page census and 1e-5 weld both. `nibContrastBuilt` is unchanged to four decimals
(1.4046, 1.4703, 1.5725). The planted-fold control still reads 1.

**The clamp on t failed first, and that is the useful part.** Forcing t into [0.01, 0.99] cleared the
census but put every crossing near a corner at the same ratio, so the tiny facets pointed the wrong
way. `assert-mode-rims` went from 7 red to 8: square/inflate wall creases 16 to **57**, cap-to-wall
edges over 30 degrees 68 to **410**, and "the rim is not a chain of cuts" went red. The same thing
in Node on a square at eight rotations: creases 546 to **1183**. Pushing the sample VALUE instead
keeps each crossing's ratio: creases **546 to 546**, off-normal faces 70 to 70, collapsed slivers
46 to 0, index buffers identical.

**Why 0.1% and not 1%.** At 1% the worst vertex moved **32% of a cell** where the surface grazes a
grid edge and both ends read near zero, and 234 of 119,644 vertices moved over 5%. At 0.1%: worst
2.35%, none over 5%, closest vertex pair 2.3e-5, still clear of the census's 1e-5 weld.
⚠ It does NOT clear a 1e-4 merge (Blender's "merge by distance" default). The glTF importer does not
merge by default, and 1e-4 would need the 1% push and its 32% move. Not checked in a real importer.

| gate | before | after |
|---|---|---|
| `assert-elbow` | 9 red, ROUTE-8 nonManifold 14 | **8 red, ROUTE-8 PASS** (0 / 0 / 0) |
| `assert-mode-rims` | 7 red, all inflate | **the same 7**, same numbers (corners 1.036 0.6085, 68 cap-to-wall edges) |
| `assert-drawin-pentip` | 1 red, parked prior 1.321 | **the same 1 red at exactly 1.321**, re-shot on the final code. The clamp had moved it to 1.482 |
| tsc | 6 errors, 2 files | 6, the same 2 files |

**The 8 elbow and 7 rims reds that remain are the round-pen predicates this row already describes.**
Those are still his: re-derive them against the nib, or accept them as the record.

**Rod, Extrude and Solid cannot reach this code.** The one caller is `inflateBuildImplicitGeometry`,
and every non-inflate rims row stays green.

**Looked at, gloss A/B, `docs/verification/engine-ab/f91-before/` and `f91-after/`, 24 frames x 5
shapes.** Circle and crossing are pixel-identical. The square differs by at most 8/255, and head-on
the two are the same picture: side walls heavier than top and bottom, the rolled corner unchanged.
The word peaks at 76/255 on ONE pixel of ONE frame (22, edge-on); the diff mask is otherwise black.
**Freshness proven both ways:** with the original file swapped back the live page read 14, with the
fix it read 0, so neither capture was a stale server.

⚠ **The dev server was not restarted.** Stopping it was refused by the auto-mode classifier. The
14/0 swap above is the proof that hot reload picked the edit up.

---

## ~~F92~~ SWEPT AND CLOSED 2026-09-04. IT WAS THE ONLY ONE, AND MY FIRST SWEEP WAS THE DEFECT.

**Answer: 0 duplicates across 558 files and 9,761 object literals.** E1's `sheen` was the only one
in the codebase and it is already fixed. The row's own guess, *"one found by accident usually means
more"*, was wrong.

⚠ **And the first instrument reported 322.** A hand-rolled brace scanner counted `{` inside regex
character classes such as `/[{,]$/`, so its stack never popped and it flagged keys **600 lines
apart** as being in one literal. It was thrown out rather than reported. The real answer came from
the TypeScript parser, which cannot make that mistake. ⭐ **A number that large out of an instrument
that cheap should have been suspicious on its face** — the same lesson as the nine wrong instruments
in explainer 51.

**Kept as a gate anyway**, `assert-no-duplicate-keys.mjs`, because the class is invisible: not an
error, not a warning, and unseen by `tsc` and by every linter here. Six rows, four of them controls,
including one that replays the exact 322 bug: a `{` inside a regex character class must not confuse
it. Runs in seconds against 9,761 literals.

Stated blind spot: spreads carry no key and computed keys cannot be compared as text, so `[a]:` and
`[b]:` are skipped rather than guessed at.

### The original row

### ~~F92 — A `sheen` KEY APPEARED TWICE IN ONE OBJECT LITERAL, AND THE LATER ONE WON~~

**2026-09-04, found by lane E1 while fixing F87. Removed. Filed because the CLASS is worth a sweep.**

A duplicate key in a JS object literal is not an error and not a warning. The later value simply
wins, so **every edit to the first one does nothing, silently, forever.** Somebody tuning the first
`sheen` would have watched a dial they were moving have no effect and had no way to see why.

This is the same family as the defects this repo keeps finding: not a wrong value, but a value that
cannot be reached. No linter in this project reports it, and `tsc` does not either for a plain
object literal.

**Worth one grep across `lib/`, `components/`, `app/` and `scripts/verify/`** for repeated keys in a
single literal. One instance found by accident while looking for something else usually means more.

---

# 🎞 LANE G2 · THE FRAME-BY-FRAME ANIMATION AUDIT, 2026-09-05

Everything below was filmed, tiled and opened. Sheets under
`docs/verification/anim-audit/`, tools beside them in `tools/`. The rig's own
calibration: two grabs of one parked state differ by **0 px**, and the
`Z99-baseline-repeat` arm is byte-identical to `A00-baseline` across all 16
steps, so every delta quoted here is the subject and not the settle.

⚠️ **Measured against the tree at 2026-09-04 23:21.** Lane G1 has since moved
`app/page.tsx`, `components/viewport-3d.tsx` and `components/style-panel-scaffold.tsx`.
Both changes were read: an em-dash purge on preset descriptions, and a
`FrameEmptyStage` that early-returns once `strokeCount > 0`. Every capture here
draws strokes first, so neither reaches anything measured.

---

## F93 · `land` COMPUTES A SHADOW NOTHING DRAWS, AND IT COSTS 0.90 CONSECUTIVE SECONDS

**Sheet: `docs/verification/anim-audit/hero/sheets/FINE-land.png` · numbers:
`docs/verification/anim-audit/hero/fine.json`**

Filmed on `/desk-doodles` at one frame of 30fps: **27 consecutive samples from
t=6.997 to t=7.883 report `changed = 0`** with ink pinned at 35786. Not one
pixel moves. Across the same span the page's own `Live: shadow` readout walks
**0.00 → 0.67 → 1.00**, exactly the `shadowLagSec` + `shadowSec` window the
phase is sized to. The secondary action is computed, correctly timed, and drawn
by nothing.

**The gap is already declared** on the page: *"Not on screen yet: the paper
break and the shadow's own timing are drawn by the viewport, which is a
separate lane."* What was never priced is what it costs. `land`'s 0.30s plus
`solid`'s 0.60s hold behind it is **0.90 consecutive seconds of frozen frame,
7.3% of a 12.37s beat, landing immediately after the beat's only moment**,
the one place a beat can least afford to stop.

⚠️ **The 0.30s is not spare time.** `solid` was sized as a held A/B frame on the
assumption that `land` before it had just delivered a move. Shortening `land`
would read this row as "the phase does nothing" when what it says is "the
phase's move has no renderer". Noted in `lib/hero-motion.ts` beside the sampler
so the next reader cannot make that trade by accident.

**Owner: whoever owns the viewport's shadow render.** Two dials and a toggle on
`/desk-doodles` (`Shadow lag`, `Shadow`, and the lands/rides pills) currently
move the numbers and not the picture, and the lands hint promises *"so something
happens in the shot after the turn"*, which is the one thing measured not to
happen. That string was left alone rather than edited around a lane doing a
copy pass in the same file.

---

## F94 · TWO SHIPPED PRESETS SPEND THEIR LAST QUARTER ON A HELD FRAME

**Sheets: `docs/verification/anim-audit/presets/sheets/` ·
profile: `presets/preset-profile.png`**

All five Family-14 presets were clicked on the rail and read back: **5 of 5
deliver their declared drawIn, window, ease and Natural/Authentic, and 5 of 5
run at cadence ones.** Nothing is broken. What the profiles show is shape.

Filmed at 16 equal slices of each preset's own beat, delay and loops included,
counting slices that change **5% or less of that arm's own peak**:

| preset | flat slices | peak Δpx | what the picture does |
|---|---|---|---|
| Looping Stroke | **0 of 16** | 13242 | never stops moving |
| Authentic Draw | 1 of 16 | 3226 | a plateau with no accent at all |
| Snappy Draw | **5 of 16** | 7549 | 96% of the ink by t=6.56s of 9.54s |
| Smooth Reveal | 6 of 16 | 8285 | a bell, 3 dead slices then 4 |
| Slow Gel | **7 of 16** | 7305 | 1.9s blank in, 2.5s still out |

**Snappy Draw's last five frames change 530, 333, 298, 56 and 0 px.** They are
the same picture, and they are 2.4 seconds, a quarter of the runtime. The cause
is not a bug: `ease: "out"` is a cubic, and a cubic's tail over a beat as long
as a real pen record is inaudible. It is a taste call about whether the ease
should run over the whole beat.

**And one string overstates its own result.** Slow Gel reads *"A beat of blank
page, then every unit lands together on the last frame."* The units do land
together, visibly, and that half is right. Measured, they land at **t=7.61s of
10.14s**, and the last frame changes 0 px. Copy lives in `lib/style-system.ts`,
which is not this lane's file.

---

## F95 · `travel` STARTS AND ENDS ON A BLANK FRAME, AND `Looping Stroke` SHIPS ON IT

**Sheet: `docs/verification/anim-audit/drawin/sheets/W01-window-travel-30.png`**

By construction, not by accident: the window is `[d(1+L) − L, d(1+L)]`, so at
`d = 0` it is `[−L, 0]` and at `d = 1` it is `[1, 1+L]`. Both empty. Measured at
all three lengths, **ink is 0 at p=0 and 0 at p=1 for travel 10%, 30% and 60%.**

Travel is also the most kinetic thing in the whole product: peak 6151 to 8007
changed px against the prefix reveal's 3229, because both edges move. The dead
ends are the price of that and they are worth naming rather than fixing blind.

Where it stops being free is the loop. `Looping Stroke` is `travel 0.3` with
`loop: true` and a **0.4s delay that re-arms on every pass**, so each loop seam
is a shrinking tail, then an empty page, then the delay, then a growing head.
Worth one decision: whether a travelling loop should re-arm its delay at all,
since the delay exists to put a beat of blank page *before* a draw and the
travel window has already supplied one.

---

## F96 · THE HERO BEAT HAS TWELVE PHASES AND THREE PICTURES

**Sheet: `docs/verification/anim-audit/hero/sheets/KEYS-phase-first-frames.png`
· profile: `hero/hero-profile.png` · ledger: `hero/report.json`**

124 of 124 seeks across 12.37s, each verified against the page's own
`x.xx s / 12.37s` readout before its frame was taken. 0 refused.

**24.4% of the beat (30 of 123 samples) changes strictly 0 pixels.** The draw is
4.67s of it at a mean 741 changed px a sample against 22,547 everywhere else,
**30x quieter**, which re-measures the known lopsidedness at real sampling
rather than adding to it.

The storyboard read is the new part. Print the first frame of each of the twelve
phases and hang them on a wall, which is the admission test a key shot has to
pass: **you get three pictures.** Flat wordmark (draw, breath, anticipation,
emerge, land, solid), wordmark in perspective at az 38° (tilt, standup, orbit,
descend), wordmark squared back up (returnTurn, hold). Nine of the twelve are
in-betweens holding a phase name.

**The beat does have real moments and they are good.** `emerge` collapses the
whole word to a **1.5%-wide sliver** at t=6.6s and it comes back heavier with a
shadow under it, which is a genuine before-and-after; `returnTurn` mirrors it at
1.6%. Two moments in 12.37s.

⚠️ **`orbit` is NOT on this list and I nearly put it there.** Under a real Play
it holds az 38.0, el 10.0 and fill 0.800 for all 13 samples of its 0.93s and
changes 0 px. Its own sampler says why: *"PARKED: the rise already arrived at
the held pose, so this phase is a dead hold and every value below is a constant.
That is the point."* A camera that genuinely stops is what makes a hold read as
a held pose instead of a pause in a pan. Deliberate, correct, and it would have
been wrong instrument number ten.

---

## F97 · DITHER AND ASCII ARE AN ORDER OF MAGNITUDE QUIETER THAN MATERIAL AND TEXTURE

**Sheets: `docs/verification/anim-audit/style/sheets/` ·
profile: `style/style-profile.png`**

30 style-animation arms filmed with the reveal PARKED at 1, so anything that
moves is the style clock and nothing else. Changed px per 0.5s against a mark of
32,354 ink px:

- **whole-frame:** Still Wet 58588 · Turn Table 56404 · Glitch Ribbon 54596
- **strong:** signalFlicker 34059 · gelShimmer 33430 · stack pulse 32192 ·
  completionFlash 31403 · scanlines 30832 · roughnessPulse 28948
- **middle:** noise 26561 · ripple 25973 · stack completionPulse 25703 ·
  shineSweep 22443 · Terminal Gel 20526 · grain 16905 · stack drift 16119 ·
  stack loop 15843 · ascii cycle 13118
- **whisper:** dither diagonal 5351 / static 4840 / vertical 4127 /
  horizontal 4055 · ascii scroll 3902 / rain 3059 / flicker 2626 ·
  Dither Bloom 3065 · Slow Weather 1373

The spread is honest to what each effect is: a threshold map flips pixels at a
boundary, a scanline sweeps the whole face. **Not filed as a defect.** Filed
because it is the answer to which of these can carry a beat and which can only
season one, and because four of the five dither arms differ from each other by
under 1,300 px, which is worth knowing before anyone spends a control on
choosing between them.

⚠️ **AND THE WORD "QUIET" IS AMPLITUDE, NOT READABILITY. I checked, and it
corrected me.** Those numbers were first judged off a 230px tile of a 1920px
frame, which is not a read. Re-shot at 1:1 through a 460x300 native window
(`sheets/ONE-TO-ONE-DIT-diagonal.png`, `ONE-TO-ONE-ASC-scroll.png`): the bayer
dots march visibly across the strokes frame to frame, and the ASCII glyphs
crawl. **Both are perfectly legible at 4,000 to 5,000 changed px, because the
change is structured and high-contrast.** Scanlines' 30,800 px is a wash across
the whole face and does not read as thirty times more motion. Changed-pixel
count ranks how much of the frame is touched; it does not rank what a viewer
notices, and this row would have said the wrong thing without the 1:1 pass.

**Not checked, and it is the rig's limit not the product's:** `revealDensity`
and the stack's `fadeIn`, `freezeOnComplete`, `revealSynced` and
`delayAfterReveal` take their clock from the playhead, and this rig parks the
playhead. Five modes that need a different instrument.

**And the instrument was wrong first.** The opening run reported **27 of 30 arms
at exactly 0 changed px.** Every family carries its own `X Animation` checkbox,
`LayerTiming.animated`, whose own doc reads *"Master switch, false means the
layer is static"*, and it is DISABLED while the family is Off. The run set every
Behaviour and timing dropdown and never ticked a box. 27 zeros is the shape of
an instrument that is not reaching its subject, not of 27 dead dials.

---

## F98 — A FIVE-WEEK-OLD STASH WITH 349 FILES IS SITTING IN THE REPO

**2026-09-05. Found by accident. NOT deleted, and it should not be until somebody checks it.**

```
stash@{0}   made 2026-07-29 14:00
            base 9f4c23e2, 2026-07-28 19:15, "test: gate distinguishes a hot-reload
                                              from a real rebuild regression"
            349 files changed, 6551 insertions, 829 deletions
```

Its base **is** an ancestor of HEAD, and three sampled files, `assert-form-orbit.mjs`,
`verify-form-orbit.mjs` and `lib/texture-shader.ts`, all exist in the tree today. So the work almost
certainly landed by another route. **"Almost certainly" is not "verified", and 349 files is too many
to eyeball.**

⚠ **A stash is the one place work can sit and be lost without anything noticing.** It survives no
branch, appears in no log, and `git status` stays clean around it. This repo already has a rule
about the shape: *"a dead worktree can hold modified tracked source."* Same class.

**To resolve it:** `git stash show -p stash@{0} > /tmp/s.diff` and check whether the diff is empty
against HEAD for each path. If it is, drop it and say so. If it is not, whatever is left is five
weeks of somebody's work that nothing points at.

**Do not drop it on a hunch.** His standing rule is never delete, especially prior work.

---

## F99 — `--only=` ON A STAGED CAPTURE WIPES EVERY ARM IT DID NOT SHOOT

**2026-09-05. Hit while calibrating a known-bad. Recovered by re-shooting in full, and it cost minutes rather than work only because the other arms were reproducible.**

⚠ **CORRECTION, 2026-09-05: the mechanism above is wrong and simpler than I wrote.** There is no
`stageEvidence` in this script at all. One unconditional line cleared the WHOLE label,
`for (const f of readdirSync(OUT)) rmSync(...)`, and then `want()` skipped every arm but one. I
filed a swap that does not happen. **A mechanism guessed from a symptom is still a guess.**

`verify-timing-origin.mjs --only=delay` re-captures ONE arm and used to delete the rest:

```
FAIL  evidence / pulse_armed_at_rest    — 0 frames (need 27)
FAIL  evidence / pulse_live             — 0 frames (need 33)
FAIL  evidence / delayed_after_reveal   — 0 frames (need 21)
```

The `--only` flag reads as "do less". It actually means "replace the label with less".

⚠ **The evidence-swap machinery is working exactly as designed here.** It exists because a wipe on
`hero-windup`, killed 14s in, deleted all 102 of its tracked files, and it made that atomic. What it
cannot know is that a partial run was intended to be partial. **This is not a bug in the swap. It is
a missing interlock between a filter flag and an atomic replace.**

**FIXED 2026-09-05.** A partial run now clears only what it is about to replace; a full run still
wipes the label, because a full run really does own all of it.

🔴 **And the first fix had the bug it was fixing.** `f.startsWith(ONLY)` means `--only=delay` also
matches `delayed_after_reveal_*`, so it would have wiped an arm it was not re-shooting. The prefix
needs a boundary: the character after the arm name must be a separator, since the files are
`<arm>_NN.png`, `<arm>.clock.json`, `<arm>-state.json`.

Proven with the exact command that caused the loss:

```
[timing-origin] --only=delay: cleared 26 file(s) for this arm, KEPT 170 from the other arms
files before: 196   files after: 196   assert-timing-frames exit: 0
```

### SWEPT 2026-09-05, and the class has ONE member

Parsed all 110 `scripts/verify/*.mjs` for the shape "wipes a whole output label AND accepts a
filter flag". **One candidate: `verify-style.mjs`. It is a FALSE POSITIVE and was already
correct** — it branches on the filter and wipes by prefix when one is set:

```js
if (prefix === null) { for (const f of readdirSync(OUT)) rmSync(...) }
else { for (const f of readdirSync(OUT).filter((f) => f.startsWith(prefix))) rmSync(...) }
```

⭐ **So the precedent existed and I invented my fix instead of copying it.** That is the repo's own
stated failure mode, a second copy of a solved idea, and it is worth recording that I walked into
it while fixing something else. The class is now closed: the only exposed script was the one this
row is about.

---

## 🔴 F100 - TURBOPACK SERVED STALE CODE THREE TIMES IN ONE SESSION, SILENTLY

**2026-09-05. Not a slow reload. A WRONG one, with no warning anywhere.**

Three separate times, an edit that was correct on disk was invisible in the browser, and each
time the page rendered the OLD string with no error, no console warning and a clean HTTP 200:

| what was edited | server age when it failed | how it was caught |
|---|---:|---|
| a new `<p>` note in the presets rail | 6 h | note absent, but the POSITIVE CONTROL pill was present |
| `text-yellow-400` to `text-amber-700` | ~4 min | served CSS had `amber-400` and no `amber-700` |
| 33 `<option>` labels | ~9 min | every option still rendered its em dash |

⭐ **The existing rule was wrong about the timescale.** `HANDOFF.json` says a server left up for
DAYS stops seeing edits. Two of these three were minutes old. **Age is not the predictor.**

⚠ **A CSS class that appears NOWHERE ELSE in the codebase is the worst case.** Tailwind v4
generates only the classes it has seen, so `text-amber-700` needed a full CSS rebuild, not a
component reload. `rm -rf .next/static` plus a restart was the only thing that produced it.

### Why this is worse than it sounds
Every browser gate in this repo photographs whatever the server is serving. **A gate run against
a server that predates an edit is grading the old build and will report PASS on code that is not
there.** That is the same class of defect as the `--webpack` run that voided a 58-gate battery,
and it is harder to see, because nothing errors.

### The rule, and it is not optional
**Restart the dev server after ANY source edit, before ANY browser gate or capture.** Not "if it
seems stale". Always. It costs 3 seconds:

```
kill <exact pid>            # never pkill -f
rm -rf .next/static .next/dev/lock
npm run dev -- --port 3105  # `next dev` is Turbopack here. NEVER --webpack.
```

⭐ **And the reason all three were caught: every check carried a POSITIVE CONTROL.** The first
read "note missing" and would have been filed as a code defect, except the control string that
had shipped for weeks was missing too, which is not a claim about the note, it is a claim about
the instrument. **A check with no control cannot tell a broken feature from a stale server.**

### Could not check
- Whether this is a Turbopack bug, a filesystem-watch limit on this Mac, or the two servers that
  briefly raced for `:3105` earlier in the session. **Three reproductions, no root cause.**

---

## F101 - `assert-citations` IS RED, AND IT IS NOT FROM TODAY'S WORK

**Proven by reverting, not by argument.** The gate ratchets three rot counts and fails on a rise:

```
FAIL  RATCHET - no citation-rot count has RISEN - uncheckable 44 -> 45
```

The baseline reads `uncheckable 44, stale 27`. The tree reads `uncheckable 45, stale 26`. **Total
rot is unchanged.** One citation was reclassified from stale to uncheckable, which means a
reader following it still lands somewhere, it just no longer has an anchor to grade against.

Three tests, each restoring real files with `cp -p` so no mtime moved:

| tree | stale | uncheckable |
|---|---:|---:|
| all 9 em-dash files reverted | 26 | 45 |
| `presetStateGap` helper removed | 26 | 45 |
| **both, fully reverted** | **26** | **45** |
| baseline on disk | 27 | 44 |

**Identical in every arm, so no edit of mine caused it.** The reclassification predates this
session and the baseline was never re-seeded.

🔴 **The baseline was NOT touched.** Re-seeding a ratchet you did not cause is how a real signal
gets buried, and the gate's own message asks you to fix it or say plainly that you added it.
This says plainly: not mine, cause unknown, still red.

### SOLVED 2026-09-05, and the gate is GREEN

**The ten that "were not printed" were printed all along, under a different word.** `uncheckable`
is incremented in TWO places: one prints `WARN UNCHECKABLE` (35) and one prints `WARN AMBIGUOUS`
(10). 35 + 10 = 45. My diff grepped only the first word, so it was blind to the bucket the change
was in. **The instrument was fine; my grep was the defect.**

All ten AMBIGUOUS rows were the same thing: a bare **`page.tsx`**, which in this repo names TWO
files, `app/page.tsx` and `app/desk-doodles/page.tsx`. A reader has to guess, and so does the gate.

Each was resolved BY TEXT, never by the line number, four of them self-evidencing:

| citation | resolves to | how |
|---|---|---|
| `viewport-3d.tsx:809` | `app/page.tsx` | its own sentence says *"On `/`"* |
| `hero-motion.ts:2589` | `app/desk-doodles/page.tsx` | **the next line names the file** |
| `hero-motion.ts:1469` | `app/desk-doodles/page.tsx` | `stampPenClock` exists in that page only |
| `hero-motion.ts:1417` | `app/desk-doodles/page.tsx` | *"merged mass with a fillet"* is in that page only |
| `hero-motion.ts:1240` | `app/desk-doodles/page.tsx` | `measurePenRecord` is in that page only |
| `style-system.ts:1404` | `app/page.tsx` | `widthSlider` is applied there |
| `style-system.ts:1596` | `app/page.tsx` | `activePresetFamily` routing is there |
| `style-panel-scaffold.tsx` ×3 | `app/page.tsx` | `StylePanelScaffold` is mounted only by that page |

⚠ **Two carried a `:NNN` and both numbers were STALE** (`page.tsx:960` and `page.tsx:133`; neither
line matches its claim today). Those were dropped rather than repointed, because fixing the path
while keeping a dead line converts an AMBIGUOUS citation into a STALE one, which is rot, and
trades a soft problem for a hard one. Each has a real anchor beside it, so it is still gradeable.

**Result: uncheckable 44 -> 35, stale 27 -> 26, ok 941 -> 951, gate exit 0.** The baseline was then
`--record`ed, which the gate itself invites on a FALL: locking in an improvement TIGHTENS a
ratchet. That is the opposite of the re-seed I refused earlier, which would have raised the
allowance to cover a rise nobody had explained.

---

## F102 - A LOG WRITE KILLED 28 GATE RESULTS, AND THE LOG IS NOT THE RESULT

**2026-09-05. The trigger was environmental. The damage was not.**

macOS revoked this terminal's access to `~/Desktop` mid-session (TCC, Privacy and Security ->
Files and Folders). Proven environmental, not repo and not the Claude sandbox: `/Users/sebs`
listed fine while `/Users/sebs/Desktop` returned `Operation not permitted`, and it failed
identically **with sandboxing disabled**. Access came back on its own and the exact write that
crashed the run now succeeds.

**What that should have cost: one log file. What it actually cost: the run.**

```
Error: EPERM: operation not permitted, open '.../browser-logs/assert-hero-option-panel.log'
    at writeFileSync (node:fs:2397:20)
    at run-browser-battery.mjs:174:3
```

The battery had judged **31 of 59** gates. All 31 were thrown away, because a battery that dies
partway is not a result, which is the rule the runner itself already prints about partial gates:
*"Those are not evidence: the run that printed them did not finish."*

🔴 **THE LOG IS A CONVENIENCE. THE VERDICT IS THE PRODUCT.** `writeFileSync` on the per-gate log
is unguarded at `run-browser-battery.mjs:174`, so any failure to write a **transcript** discards
every **verdict** already earned. A full disk, a permissions change, a read-only mount or a
sandbox rule all land the same way, and none of them is a statement about the code being graded.

**The fix: catch it, say so loudly, keep going.** Not a silent `try {}`, because a run whose logs
vanished without a word is its own trap. Warn per gate, count them, and put the count in the
summary so a run with missing transcripts can never be mistaken for a clean one.

### Checked, and the model half is clean
`run-battery.mjs` has no per-gate log write at all. It writes `battery.json` once at the end, so
there is no equivalent hole. **Grepped rather than assumed.**

**FIXED 2026-09-05** in `run-browser-battery.mjs`: the transcript write is guarded, warns per gate
with the errno, and the count plus the gate names ride the summary.

---

## 🔴 F103 - A PAIRED CONTROL THAT CRASHED WAS SCORED AS A CONTROL THAT STAYED SILENT

**2026-09-05. Found while consolidating a duplicated helper, which is not where I was looking.**

Six gates carried their own copy of `paired(name, real, controlName, control, detail)` in **four
different variants**. Two of them, `assert-export-live` and `assert-export-encoders`, wrapped both
sides in try/catch:

```js
try { b = control() } catch (e) { be = e.message.split("\n")[0] }
const ok = a && !b
```

**When the control THROWS, `b` stays false, so `ok` collapses to `a` and the row PASSES.** And the
detail string is only built when `!ok`, so `be`, the caught error message, was **discarded in
exactly the case that needed it**. Demonstrated side by side, same helper, same inputs:

```
-- control returns false (healthy) --
PASS  row A detail
-- control THROWS (broken instrument) --
PASS  row B detail          <- identical line, error never printed
```

⭐ **A paired control exists to prove the row can fail.** `ok = real && !control` is only
meaningful if `control` actually RAN and actually said no. A control that crashed said nothing at
all, and treating silence as a no is how a row goes on passing after the feature it grades is
gone. Same family as a positive control that skips itself when its subject is deleted, and a
one-place gate that goes vacuously true when one place is left.

**14 call sites rode it**: 6 in `assert-export-live`, 8 in `assert-export-encoders`.

### The other four copies, checked rather than assumed

| file | shape | exposed? |
|---|---|---|
| `assert-export-live` | thunks, try/catch both sides | 🔴 **YES** |
| `assert-export-encoders` | thunks, try/catch both sides | 🔴 **YES** |
| `assert-export-app`, `assert-export-window` | same two bodies as the pair above | see note |
| `assert-export-plan` | thunks, NO try/catch | no, a throwing control crashes the gate loudly |
| `assert-take-timeline` | takes VALUES, not thunks | no, nothing can throw inside it |

**FIXED** by `scripts/verify/lib/paired.mjs`, one implementation, `row` injected so each gate
keeps its own reporting. Either side throwing now fails the row and NAMES which side threw,
because "the check is wrong" and "the feature is missing" are different problems that cost
different afternoons. Proven across five cases: healthy PASS, control-throws FAIL, control-passes
FAIL, real-throws FAIL, real-false FAIL.

### Could not check
- `assert-export-app` and `assert-export-window` share a body hash with the two fixed files but
  were **not migrated in this pass**, so the same defect is very likely live in them. **Not
  measured, not fixed. Next thing to do here.**

---

## F104 - THE PRODUCTION FENCE IS UNSWEPT ON EVERY BATTERY RUN, BY DESIGN

`assert-debug-surface-fenced` grades two channels. §1 DEV runs against the dev server. §2
PRODUCTION needs a real `next build`, served, and named with `--prod-port`. **`run-browser-battery`
does not pass it**, so every battery run ends:

```
UNSWEPT  §2 · PRODUCTION - no --prod-port was given, so no production build was ever looked at.
PARTIAL - 4 row(s) passed and 1 channel(s) were NEVER REACHED.
Exiting 3, not 0. A SKIP IS NOT A PASS.
```

⭐ **The gate is behaving correctly and this row is not a complaint about it.** It refuses to
report a pass on a channel it never reached, which is the whole doctrine. The problem is that the
battery's headline then carries a permanent PARTIAL that a reader learns to skip past, and
**the fence that keeps the debug surface out of production is the last thing that should become
background noise.**

**SWEPT BY HAND 2026-09-05, 8/8, exit 0**, against a real `next build` served on :3106:

| row | result |
|---|---|
| 2.0 CONTROL, the transport row rendered here too, so a zero below is about the guard | PASS |
| 2.1 ⭐ NO Debug button anywhere in the production build | **0 on screen** |
| 2.2 no style-substrate readout, the panel is not merely hidden behind a missing button | `"activeMaterialPreset"` in text: **false** |
| 2.3 all three window harnesses fenced | `__revealHarness` `__captureHarness` `__styleHarness` all `undefined` |

⚠ **Two servers means you must name the port.** `lib/dev-server.mjs` refuses to guess and says so:
*"Which one a gate should grade is your call, not this module's."* Run it
`FS_PORT=3105 node scripts/verify/assert-debug-surface-fenced.mjs --prod-port=3106`.

### FIXED 2026-09-05
`run-battery.mjs` already had `EXTRA_ARGS`, the per-gate flag table, and its own comment sets the
bar: *"A gate is in here only when leaving it out would make the sweep LIE."* A permanent PARTIAL
on the production fence is exactly that, so the entry belongs there.

**One knob, one name**, like `FS_PORT` and `FS_HEADED`:

```
npm run build && npx next start --port 3106
FS_PROD_PORT=3106 FS_PORT=3105 node scripts/verify/run-browser-battery.mjs
```

Unset, `extraArgsFor` returns `[]` and the gate behaves exactly as before, still refusing to claim
a channel it never reached. Both states tested. Proven end to end against a real `next build`:

```
pass      assert-debug-surface-fenced.mjs      8 rows  15.7s
1/1 browser gates green    battery exit=0
```

against the 4-row PARTIAL it produced before.

---

## 🔴 F105 - THE DESK DOODLES 3-D STAGE IS 121px TALL AT THE DEFAULT WINDOW, IN PRODUCTION

**Measured live 2026-09-05, dev AND a real `next build`, identical in both.**

`/desk-doodles` is height-bounded (`100vh`, overflow hidden) and `DialTimeline` portals a FIXED
dock to the bottom. A spacer reserves the dock's measured height, so **whatever the dock takes,
the 3-D stage loses**. The stage is the last thing in the box, so it absorbs all of it:

| window | 3-D canvas |
|---|---|
| 1280x720, Playwright's default | **121 px tall** |
| 1440x900 | **301 px** |
| 1280x1400 | 801 px |

At 1440x900 the canvas sits at y=68 with h=301 in a 900px window. **The hero form gets a third of
the page and the timeline inspector gets half.** Confirmed on the production server too:
`canvas {y:68, h:301}`, dock present. `dialkit` is a **runtime dependency**, not a devDependency,
and `Hero beat` is in `.next/server/app/desk-doodles.html`.

⚠ **The dock's own comment is right about why the spacer exists** (a fixed overlay would cover the
transport and the phase ruler you need WHILE dragging a clip). This row is not about the spacer.
It is that nothing bounds the DOCK, so on a laptop window the subject of the page is 121px.

**HIS CALL**, because all three fixes are design decisions: cap the dock at a fraction of the
viewport, collapse it by default (it already has a chevron), or fence it out of production.

---

## F106 - `assert-register-light`'s NUMBER CANNOT BE REPRODUCED AT THE COMMIT THAT PRODUCED IT

The row `fsH.mean > ddH.mean * 1.4` fails today at **77.04 vs a bar of 77.08**. It misses by
**0.04**. The 08-28 battery logged **132.78 / 60.3** and passed.

🔴 **I checked out the exact commit that run recorded as its HEAD** (`f9781d7a`, from
`browser-2026-08-28/state-finish.txt`) in a worktree and ran the same gate: **76.68**, not 132.78.
**Byte-identical code, same gate, and the park line agrees to the digit in both runs**
(`parked at 9.75s of 12.37s`).

Every candidate excluded, each by measurement, not argument:

| candidate | verdict |
|---|---|
| the app code | **excluded.** 08-24 `4c752f1b` 76.79 · 08-28 `f9781d7a` 76.68 · 08-28 `c9f8cecc` 77.04 · 09-04 `d1cfcad7` 77.04 · HEAD 77.04 |
| the gate | **excluded.** unchanged since `4c752f1b`, 08-24, which is before every run compared |
| the beat moving | **excluded.** park point identical in all four logs |
| window size | **excluded.** both halves pin `1440x900` explicitly |
| the dialkit dock landing | **excluded.** already present at `f9781d7a`, which logged 132.78 |
| the dialkit VERSION (a `^` range) | **excluded.** 1.4.3 installed, 1.4.3 in the lock, installed Aug 4 |
| a software renderer fallback | **excluded.** `ANGLE Metal Renderer: Apple M4 Max` |

**So the value moved without the code moving, and I could not find what did it.** Recorded as
unknown rather than guessed.

⭐ **The registers are still obviously distinct, and that is the part that matters for the
product.** The pictures are chrome-and-lit versus flat matte black, and the gate's own chroma row
reads **13.19 (FS) vs 0.02 (DD)**. The failing row is a PROXY for "FS kept its own look" and the
direct evidence says it did. **The 1.4x bar was NOT touched.**

---

## F107 - `verify-register-light` WAS SHIPPING TWELVE BLANK FRAMES, AND THE GATE HAD ALREADY FIXED ITSELF

Every one of the 12 register captures was **the empty grid with no form at all**. The tell was in
the file sizes: each FS/DD pair had gone byte-identical (`6027/6027`, `7014/7014`). **Two registers
that exist to look different cannot compress to the same size.** `free-stroke_a-headon` was
**79,125 bytes** committed on 08-24 and came back **2,573**.

The cause was already written down, in the gate beside it: `/desk-doodles` now OWNS the reveal
clock, `HostRevealTick` copies `revealRef.current` into the playhead EVERY FRAME, so
`__revealHarness.setProgress(1)` is overwritten before the next paint, and at the transport's
t = 0 the beat's own reveal is 0. `assert-register-light.mjs` diagnosed that and fixed itself by
parking the transport in `orbit`. **Nobody carried the fix to the capture half**, which went on
photographing an empty stage.

**FIXED**, fix ported. The captures now park at `9.75s of 12.37s` and come back **16,680 (FS)** and
**12,301 (DD)**, different sizes again, and looked at: Free Stroke is a lit chrome solid, Desk
Doodles is flat matte black. Exactly what `lib/registers.ts` says they are.

⚠ **I overwrote the good committed frames with blanks before noticing.** Restored from HEAD with
each file's mtime set to its own last content commit (2026-08-24 16:14), so restored evidence
cannot pass itself off as freshly shot.

---

## F108 - `assert-drawin-timing` FAILS UNDER LOAD, AND THE FEATURE IS FINE

**Measured 2026-09-05.** The gate went red inside a battery that was sharing the machine with a
production server and a browser battery's Chromes:

```
FAIL  CONTROL · that sample landed mid-pass, so the identity above was read while the clock was
      still moving — playhead 1.000000 after playing 588ms of a 1680ms pass
```

On a quiet machine, **4 runs, 4 passes**, and the same control reads what it is supposed to:
`playhead 0.337321 after playing 588ms of a 1680ms pass`.

⭐ **The row that fails is a CONTROL, not the claim.** It exists to prove the identity above it
was read while the clock was still moving, which is exactly the right thing to check. Its
*instrument* is the problem: it sleeps a fixed **588ms** of wall time and assumes a 1680ms pass
will still be running. Under load the page misses frames, the pass finishes early, the playhead
reads 1, and the control correctly reports that its own sample is worthless.

**So it is not crying wolf. It is reporting an unusable sample honestly, which is the behaviour
this repo wants.** The cost is that it reads as a product failure in a battery summary.

**The fix, when somebody takes it,** is the lesson the Delay row already learned today: grade
against the PAGE'S OWN CLOCK rather than against wall time. Ask the playhead where it is and
sample when it is between two bounds, instead of sleeping a constant and hoping. A fixed sleep
is a bet on the machine.

### SWEPT 2026-09-05, and this class also has ONE member

Two passes over every `assert-*.mjs`. Seven gates sleep a constant and then read a clock-ish value
within six lines: `drawin-timing`, `export-app`, `hero-option-panel`, `layer-flicker`,
`preset-pixels`, `stroke-schedule`, `take-persists`.

But the defect is narrower than that, and the difference matters. **A settle-sleep is fine.** What
breaks under load is sleeping a constant and then asserting the playhead is INSIDE A BAND, because
a missed frame moves it out. Searching for that shape specifically, `x > a && x < b` on a
playhead:

| gate | band assertion on a playhead |
|---|---|
| `assert-drawin-timing` | **YES**, `defHead > 0.2 && defHead < 0.8` — the one this row is about, fixed |
| the other six | **none.** They sleep to let something settle, then read a value they do not band |

**So the class is closed at one, and it is the one already fixed.** The six are not on a list to
come back to, which is the point of sweeping rather than assuming.

---

## 🔴 F109 - THE REPO LIVES IN AN iCLOUD-SYNCED FOLDER, AND THAT IS WHY THE MACHINE KEEPS LOCKING US OUT

**The biggest operational finding of the day, and it is not a code defect.**

```
defaults read com.apple.finder FXICloudDriveDesktop   ->   1
repo path                                             ->   /Users/sebs/Desktop/Projects/free-stroke
```

**Desktop and Documents sync to iCloud, and this repo is inside Desktop.** iCloud is continuously
syncing a `.git` of **4.1 GB**, a `node_modules` of **1.3 GB**, and every evidence PNG the
verification tree writes.

### What it cost today, measured

| symptom | evidence |
|---|---|
| **Three lockouts** of `~/Desktop` mid-session | `/Users/sebs` listed fine while `/Users/sebs/Desktop` returned `Operation not permitted`, **and it failed identically with sandboxing disabled**, so it is macOS, not the agent harness |
| **A browser battery destroyed** at 31 of 59 gates | `EPERM` on ONE log write (F102) |
| **Gates dying before their first assertion** | `Error: EPERM: process.cwd failed with error operation not permitted, uv_cwd` |
| **A queue write killed mid-file** | this very row failed to save on its first attempt, and took **168 s** of polling to get a stable window |
| **Chronic CPU load** | `bird` (iCloud Drive) at **90%**, `FSEvents` at **108%**, load average **26 to 39** with nothing of ours running |

⭐ **Load is not cosmetic here: it makes gates lie.** `assert-drawin-timing` failed inside a loaded
battery and passed 4 of 4 quiet (F108). **A verification suite whose verdicts depend on whether
iCloud is mid-sync cannot be trusted on either answer**, and this repo's whole method is that a
green gate means something.

### FIXED 2026-09-06, on his instruction

`~/Desktop/Projects/free-stroke` -> **`/Users/sebs/Projects/free-stroke`**, which is outside both
synced roots. Same volume, so the `mv` was atomic.

**What moving a project actually costs, in case this is done again for the other repos:**

| step | detail |
|---|---|
| absolute paths in CODE | **3 files**, repointed: `.mfst-tune.mjs`, `.mfst-irid.mjs`, `docs/storyboard/tools/measure.mjs` |
| absolute paths in EVIDENCE | **8 JSONs left alone on purpose.** They RECORD where a run happened; rewriting them would falsify the record |
| the running dev server | held port 3105 with a working directory that no longer existed. Killed by exact pid |
| 🔴 **the Turbopack cache** | **`.next` has the old absolute paths baked in.** Clearing only `.next/static` was not enough: the server came up, served 200s, and then `FATAL: An unexpected Turbopack error occurred`, which killed three browser gates with *"Execution context was destroyed, most likely because of a navigation"*. **`rm -rf .next` is mandatory after a move.** |

Verified from the new location: tsc baseline 4/4 with both routes serving, `assert-no-em-dashes`,
`assert-one-knob`, `assert-citations`, and three browser gates green with **0 Turbopack FATALs**.

### 2026-09-07: HE WANTED THE PATH BACK. IT IS BACK, AS A SYMLINK

*"Move it back just fix the sync issue"*. A plain move-back cannot do both, and the reason is the
size breakdown:

| | size | can it be excluded from sync? |
|---|---:|---|
| `docs/verification` | **7.1 G** | 🔴 **no.** It is the repo's tracked evidence, and it is what churns hardest during a capture |
| `.git` | 4.5 G | only by relocating the gitdir, which is structural |
| `node_modules` | 1.3 G | yes, regenerable |
| `.next` | 201 M | yes, regenerable |

**Excluding the two easy ones covers 1.5 G of 14 G and leaves the worst offender behind.** So the
bytes cannot stay on the Desktop.

**`~/Desktop/Projects/free-stroke` is now a symlink to `~/Projects/free-stroke`.** iCloud stores
the link, not the target: `du` at the Desktop path reads **0 B** against **14 G** at the real one.
The old path works for `cd`, for git, and for every tool tried.

⭐ **Turbopack accepts a symlinked project ROOT**, which is worth writing down because it REFUSES a
symlinked `node_modules` pointing outside the project (*"Symlink node_modules is invalid, it points
out of the filesystem root"*, hit on 09-05). Root and subdirectory are not the same check.

Verified through the symlinked path: dev server ready in 341 ms with **0 Turbopack errors**, tsc
baseline **4/4** with both routes serving, `assert-citations` and `assert-one-knob` exit 0, and
`form-channel`, `drawin-timing`, `camera-frames-the-drawing` all green.

**Load fell from 26-39 to 9.4** and `bird` dropped out of the top three processes.

### 🔴 2026-09-07: HE WANTED IT ALL BACK, AND MOVING BACK LOOKED LIKE DATA LOSS

*"No move it all back"*. Done, and the repo is at `~/Desktop/Projects/free-stroke` again, 14 G,
symlink gone. **But the move back went through a state that looked exactly like a wiped repo, and
anyone doing this needs to know the shape before it happens to them.**

Sequence, all within about two minutes:
1. `mv` reported success. `du` read **14 G** at the Desktop path and `assert-tsc-baseline` passed
   **4/4**, so the move looked clean.
2. Minutes later the same path held **one file**: no `.git`, no `scripts/`, no `node_modules`.
   Gates failed with `MODULE_NOT_FOUND` on their own filenames.
3. **The data was never gone.** iCloud had a pending DELETE recorded for `free-stroke` from when
   the folder left the synced tree, and it resolved the conflict by renaming the incoming copy to
   **`free-stroke 2`** rather than merging. All 14 G, HEAD intact, 389 verify scripts, 182 packages.

⚠ **`.icloud` placeholders were ZERO, so this does not look like eviction.** It is a name
collision, and the tell is a sibling directory with a space and a digit appended.

**Recovery:** stop the dev server first, because it recreates `.next` inside the empty stub and
makes it look occupied. Remove the stub after checking it holds only build output. Rename
`free-stroke 2` back. Then `rm -rf .next` and repoint the 3 absolute-path files.

Verified after: tsc **4/4** with both routes serving, `citations` and `one-knob` exit 0, and
`form-channel`, `drawin-timing`, `camera-frames-the-drawing` green.

🔴 **The sync problem is BACK, by his decision, twice stated.** iCloud is syncing 14 G again, of
which 7.1 G is `docs/verification` and cannot be excluded. Expect the `~/Desktop` lockouts, the
`uv_cwd` failures and the load-driven false reds to return. **A red gate here should be re-run on
a quiet machine before it is believed.**

### ⚠ THE OTHER TWENTY-THREE REPOS ARE ALSO IN THE SYNCED FOLDER
`~/Desktop/Projects/` holds about fifteen repos and he consolidated them there deliberately on
2026-05-17. Only free-stroke moved. Measured right after: load **35**, with `bird` at 89% and
`FSEvents` at 100% still, plus one of his own portfolio processes at **264%**. **So this repo's
gates are out of the blast radius and the machine is not.** Moving the whole `Projects` folder to
`~/Projects` is the one-move version and keeps his structure exactly as he set it up. His call.

### Could not check
- Whether iCloud eviction also explains **F106**, the register ink mean that moved without the code
  moving. It is the right shape for it. **That is a hypothesis, not a measurement.**


### 2026-09-24: THE REPO STAYS ON THE DESKTOP AND ICLOUD NO LONGER SYNCS IT
His words: *"We're keeping it on desktop. Why is it syncing like this? Fix it"*. He had rejected
both the move out and the symlink (09-07), and this row never tried the third way.
**`xattr -w 'com.apple.fileprovider.ignore#P' 1 ~/Desktop/Projects/free-stroke`**, set 2026-09-24.
The folder keeps its name and its place; iCloud Drive stops syncing it (undocumented but reliable on
Ventura, Sonoma and Sequoia; this Mac is 15.6.1. Sources: eclecticlight.co 2024-07-09 and
2026-01-06, github.com/edtadros/icloud-nosync). Checked before setting it: **0 dataless files** (a
cloud-only file under an ignored folder could be left missing). After: 70,879 files before and after,
0 dataless, git clean. **Undo:** `xattr -d 'com.apple.fileprovider.ignore#P' ~/Desktop/Projects/free-stroke`.
Side effect: the iCloud copy of this folder is dropped from iCloud and other devices; the Mac and git
keep everything.

**Why it mattered:** iCloud had written **853 conflict copies** (`name 2.png`) into
`docs/verification/`, and gates read them as evidence: `material-craft` read `ceramic 2` as its own
preset and went red. 663 were byte-identical to their originals and he deleted exactly those
(`docs/verification/f117/icloud-identical-copies.*`); `material-craft` is 13/13 again. Left for a
look: 8 copies that DIFFER from their originals (mostly `hero-transition/carve-prior` videos), 11
conflict folders (`pentip/run 2`, ...), and one tracked copy, `geometry/sp_before/closedO_extrude 2.png`.

**A Turbopack panic followed, and it was NOT the attribute.** Deleting 663 files while Tailwind was
scanning left a 2716 s recompile and `timeout while receiving message from process` on
`app/globals.css`; a restart panicked the same way. Moving `.next` aside (585 M, kept at the session
scratchpad as `next-cache-2026-09-24`) fixed it: ready in 235 ms, `/` and `/desk-doodles` 200, 0
panics, attribute still set. **Watch for:** new `* 2.*` files appearing in the repo. None should.
---

## 🔴 F110 - THE STYLE PANEL SCROLLS TWO SCREENS WHILE 80% OF ITS WIDTH SITS EMPTY

**G1 filed this shape; these are the numbers, measured 2026-09-05 on `/` at three window sizes.**

Opening any style panel PUSHES the 3-D viewport down instead of overlaying it:

| window | 3-D canvas before | after | lost | panel scrolls |
|---|---:|---:|---:|---|
| 1500x1000 | 908 px | **467 px** | **441 px** | 1.7 screens |
| 1440x900 | 808 px | **367 px** | **441 px** | 1.7 screens |
| 1280x800 | 708 px | **331 px** | **377 px** | **2.0 screens** |

**The subject of the app loses roughly HALF its height the moment you touch a control.**

And it is not spent on the controls. With the ASCII panel open at 1500x1000, its **9 controls span
x=213 to x=469: 256 px of a 1292 px panel.** ⭐ **1036 px, 80% of the width, is empty**, while the
same panel clips its own content and asks you to scroll two screens to reach it. The last control
visible is cut through the middle of its own label.

⚠ **The app already has the other pattern and uses it elsewhere.** The Timing popover is 42rem and
OVERLAYS the viewport rather than displacing it, and it was made two-column
(`columns-2 [&>*]:break-inside-avoid`) for exactly this reason on 09-04. **The drawer did not get
the same treatment**, so two surfaces in one product answer "where does a control panel live"
differently.

### Why it is filed and not fixed
This is the UI visual-language work he PARKED: *"tomorrow, I will give you some stuff that we can
look on for our UI visual language redo... Not yet. Not yet. Do not do any of that yet."*
Measuring it is not redesigning it, and tomorrow's session should start from numbers rather than
from an argument. **Related: F105**, where the same failure runs the other way on `/desk-doodles`,
a fixed dock taking the stage down to 121 px at the default window.

### It also breaks a gate, which is how it surfaced
`verify-screen-layers` fixes its crop bed at startup and refuses to move it, by design, because
the bed is what makes `final/` comparable. Panels shifting the canvas under that bed is what makes
the capture refuse. **So this is not only a look problem: it is why `assert-screen-layers` has been
un-capturable since 08-28.** Fixing the displacement fixes the gate without touching the bed.

---

## F111 - `~/.fs-lanes` IS 107 G AND MOST OF IT IS THE 09-04 AUDIT LANES. WHAT IS SAFE TO DELETE, MEASURED

**Nothing under `~/.fs-lanes` was deleted.** Standing rule: a lane copy can hold work that never
reached the repo. This row is the map, so the call can be made on facts.

**Method.** A lane is not "safe" because its files DIFFER from main, since most lanes are simply
older snapshots. The test used is stricter: hash every lane source file and ask whether that exact
blob exists in ANY commit of the main repo. Then list every `docs/` path that exists only in the lane.

| lane | size | unique source | unique `docs/` | verdict |
|---|---:|---:|---:|---|
| **laneD3** | **13 G** | a real git checkout, **HEAD `b54dcef0` is in no commit of main**, 934 dirty | - | 🔴 **holds unique work. Keep.** |
| **laneE3** | 9.0 G | 0 | 9, incl. `elbow-nib1`, `elbow-nib2`, `elbow-nib2.4` | 🔴 **nib captures for F91, the open nib decision. Keep.** |
| laneE1 | 1.9 G | **8** lane-written probes (`_probe-e1-*`) | - | salvage first |
| laneC2 | 9.0 G | 1 (`assert-screen-layers.mjs`) | - | salvage first |
| laneD1 | 9.0 G | 1 (`assert-carve-graze.mjs`) | - | salvage first |
| laneE2 | 1.7 G | 1 (`_probe-elbow-nib.mjs`) | - | salvage first |
| laneC3 | 9.0 G | 0 | 8, mostly `.staging` leftovers + 1 video | near-duplicate |
| laneG1 / G2 / G3 | 27 G together | 0 | **1 each, the SAME Playwright video** (`page@799520a...webm`) | 27 G holding one file |
| **laneD2** | 1.7 G | **0** | **0** | ✅ **pure duplicate** |

Each full lane carries its own `node_modules` (1.3 G), `.next` (~270 M) and a complete copy of
`docs/verification` (7.1 G), which is where the size comes from.

**Not from this work and not assessed for deletion:** `battery-0828` (12 G, 08-28, git checkout,
650 dirty, HEAD is in main), `laneZ` (6.8 G, 08-07), and 32 small lanes from 08-07.

### 2026-09-18: SALVAGED, AND ONE LANE HELD A FIX THAT HAD NEVER LANDED

**The salvage is done and ALL ELEVEN lanes are now safe to delete, D3 and E3 included.** Nothing
was deleted.

**`~/.fs-lanes/_salvage-2026-09-04/`**, 458 items, 342 MB, with `MANIFEST.tsv` and a `README.md`.
Every item was compared byte-for-byte with its lane copy after the copy: **458 of 458 match**, and
`cp -p` kept the mtimes so evidence keeps its provenance.

The first pass was not enough, and two widenings each found more:
1. Checking only `lib/ app/ components/ hooks/ scripts/` and `docs/` missed **15 lane-root items**,
   nine of them probe scripts (five in C2, four in E2), plus C3's own `HANDOFF.json`.
2. `git status` never shows ignored files, so laneD3 got a separate `--ignored` pass: 27 paths,
   26 identical in main's working tree, 1 salvaged.

🔴 **The real find: laneD3 held a gate fix that had been sitting unlanded for two weeks, and the
gate it fixed was passing BLIND.** Of D3's eight commits, seven had merged; `b54dcef0` had not.
`assert-export-window`'s *"Q1 · the REORDER is IN the film"* compared `{reversed, overlap 1}`
against `{asDrawn, overlap 0}`, and at overlap 1 unit order does nothing (checked in
`lib/stroke-schedule.ts`: start = `seqStart·(1−ov) + concStart·ov`, and `concStart` ignores order
under align start). **Proven on the branch's own version: with the reorder removed, the row still
printed PASS.** Landed as `5afc0dc9`; the same mutation on the landed version turns it red. D3's
commit is also kept as `refs/salvage/laneD3`.

Every other lane edit to a gate was checked and **none should land**: each is older than HEAD, and
C2's would reintroduce the "7.6x" claim HEAD corrected in `d076588b`. Details in the salvage README.

| reclaimable if deleted | |
|---|---:|
| C2, C3, D1, E3, G1, G3 | 9.0 G each |
| G2 | 8.9 G |
| **D3** | **13 G** |
| E1 / D2 / E2 | 1.9 / 1.7 / 1.7 G |
| **total** | **~90 G** |

**DONE 2026-09-22.** Re-checked first: 0 files in the eleven newer than 09-18 (the one hit was
laneD3's `.git`, read at 00:19 on 09-18 to land `5afc0dc9`), 0 processes inside, `refs/salvage/laneD3`
present. Deleted by him with the exact command below. `~/.fs-lanes` 107 G to 26 G. What is left: the
08-07 copies (about 9 G in 30 dirs, never audited for unique work), `laneZ` 6.8 G, `battery-0828`, and
`_salvage-2026-09-04`.

~~**Unblocks with one word from him: "delete the 09-04 lanes."**~~ The command is exact-path, no glob:
`rm -rf ~/.fs-lanes/{laneC2,laneC3,laneD1,laneD2,laneD3,laneE1,laneE2,laneE3,laneG1,laneG2,laneG3}`.
The salvage folder, `battery-0828`, `laneZ` and the 08-07 lanes are NOT in it.

⚠ **Process lesson worth a gate one day:** a lane can finish, file its rows, and still leave its
best commit behind, and nothing notices. A close-out check of "is every commit on this lane
reachable from the branch?" would have caught `b54dcef0` on 09-04.

---

## F112 - THE 07-29 STASH (F98) AND THE TWO v0 COMMITS, BOTH PREPARED TO ONE WORD

### The stash: superseded, and pinned so dropping it loses nothing

`stash@{0}`, 2026-07-29, 349 files, base `9f4c23e2`. Tested properly: each stashed blob against
the **59,262 objects reachable from HEAD**, not against `--all`, because `--all` includes the
stash's own commits and would find every stash blob inside the stash itself. That first,
wrong version of the test is how a stash reads as safe when it is not.

**347 of 349 stashed files have content already reachable from HEAD.** The other two are early
drafts of files HEAD has since rewritten many times:
- `lib/ascii-shader.ts`, a first draft of **ROUND DOTS**, which LANDED: HEAD carries the same
  `// ROUND DOTS.` header at line 339.
- `lib/style-system.ts`, 316 lines of 07-29 WIP in a file with seven weeks of later commits.

**Pinned as `refs/salvage/stash-2026-07-29` (`71ebbace`).** Unblocks with: *"drop the stash."*
`git stash drop stash@{0}`, and the ref still holds every byte.

### The two v0 commits: the branch cannot be pushed until they are reconciled

`origin` carries two `v0` bot commits from 2026-08-08 that the branch does not: `bee27676` and
`ea9a004b`. They add `CHAT_HISTORY.md` (a new file, merges clean) and edit
`scripts/capture/capture-frames.mjs`, which **conflicts** with HEAD's own later edits.

⚠ **What v0's edit actually does:** it adds `STROKE_SOURCE` to choose between `trace` (the traced
logo) and `font` (the `layoutWord` hand font), and **defaults it to `font`, which silently changes
what the capture script draws.** `scripts/capture/letters.mjs` exists on both sides, so the merge
is feasible; the only real question is that default.

**Recommendation: merge, keep v0's switch, set its default to `trace`,** so the capture still draws
the logo it draws today and the font is one env var away. Unblocks with: *"merge v0, keep the
logo"* or *"merge v0 as is."* Nothing is pushed either way until he asks.

---

## F113 - A CODEX CROSSCHECK OF THE TEN INSTRUMENTS WRITTEN THIS SESSION, PREPARED AND BLOCKED ON QUOTA

**Why it is worth running.** Every instrument below was written by the same model that then checked
it, so their errors are correlated. The `codex-crosscheck` skill's own measurement: on 2026-08-28
**all six of its findings were in code written that same day**, because that is where shared
confidence hides a known-bad. This session supplied three examples of exactly that shape already:
a paired control that passed while crashing (F103), an `--only` fix with the bug it was fixing
(F99), and a reorder row that passed with no reorder (landed from lane D3 as `5afc0dc9`).

**Blocked on a real thing, checked rather than assumed.** The readiness probe made one real call
and it was refused: *"try again at Sep 19th, 2026 4:29 AM."* `codex --version` read `0.153.4` and
would have looked healthy. **Nothing of his ChatGPT quota was spent.**

**Prepared:**
- `docs/crosscheck/2026-09-18-instruments.prompt.txt`, the skill's template filled: the ten files,
  the CLOSED list (his em-dash rule, no bar relaxation, red gates already filed, taste, repo
  location), the one question, the denominator, and what it could not check.
- `docs/crosscheck/run-2026-09-18.sh`, which re-probes first and stops if the quota is still empty,
  then runs one `-s read-only` pass with the prompt on stdin and writes
  `docs/crosscheck/2026-09-18-instruments.reply.md`.

**Its refusal arm is proven:** run on the empty quota it stops before spending and prints the reset
time. ⚠ **Its READY arm has never run on this account.** The first run after the reset is its check.

**Unblocks at Sep 19, 4:29 AM with:** `docs/crosscheck/run-2026-09-18.sh`. It spends **one scoped
pass on his ChatGPT account**, not Anthropic's. Then every finding is reproduced before it is
believed, each gets filed including the rejected ones, and after a fix the finder's own mutation is
re-run to go red.

**2026-09-22 update: the reply is in and four of ten findings are closed.** Codex answered in
`docs/crosscheck/2026-09-18-instruments.reply.md`. Each finding below was reproduced at model level
before it was believed, and each closed one had Codex's own mutation re-run against the fix.

| # | file | reproduced | fixed | Codex's mutation now red | commit |
|---|---|---|---|---|---|
| 1 | `lib/paired.mjs` | yes, 5 of 5 mutations passed as pairs | yes | yes, 5 of 5 | `45c003c5` |
| 2 | `lib/browser.mjs` | yes, 3 of 3 on the old `reapOrphans` with a fake ps and kill | yes | yes, 3 of 3 | `fce47dfe` |
| 3 | `run-battery.mjs` | yes, FAIL-at-exit-0 and empty child both exited the sweep 0 | yes | yes, both exit 1 | `a8335f71` |
| 4 | `run-browser-battery.mjs` | yes, same two, same result | yes | yes, both exit 1 | `a8335f71` |
| 5 | `assert-drawin-timing.mjs` | not started | no | no | |
| 6 | `verify-timing-origin.mjs` | not started | no | no | |
| 7 | `assert-timing-frames.mjs` | not started | no | no | |
| 8 | `verify-register-light.mjs` | not started | no | no | |
| 9 | `assert-no-em-dashes.mjs` | not started | no | no | |
| 10 | `assert-export-window.mjs` | not started | no | no | |

- **1.** `throw ""`, an Error whose message starts with a newline, a control returning `NaN` or
  `undefined`, and an `async` real side returning false all passed. Now any throw is a throw and a
  side must return a real boolean. `scripts/verify/_probe-crosscheck-paired.mjs`: 12 of 12 arms on
  the fix, 6 of 12 on the old file. Model gates on `paired()` unchanged: export-plan 12/0,
  export-encoders 8/0, assert-paired-controls 6/6. The four browser gates that call it
  (take-timeline, export-live, export-app, export-window) were read, all 58 call sites return
  comparisons, and none was run.
- **2.** Ownership is now the whole marker, bounded by whitespace or the ends. An empty or bare
  marker matches nothing, and a record stays when a pid it owns survives the kill or cannot be read.
  `_probe-crosscheck-browser.mjs`: 16 of 16. assert-one-browser still 32/0.
- **3 and 4.** The rule lives once in `run-battery.mjs` (`failedAtZero`, `cleanGreen`, `sweepExit`)
  and the browser runner imports it. Checked in a scratch copy of the repo with mocked children,
  never against :3105: good 0, FAIL-at-0 1 (was 0), empty 1 (was 0), FAIL-at-1 still 1, for both
  runners.
- 🔴 **Real-tree verdict that changes.** The last model battery record (2026-09-05, 54 gates) has
  `docs/storyboard/tools/assert-moment.mjs` at exit 0 with **25 FAIL rows of 46**. Run today it still
  exits 0 and prints FAIL for the rejections in its truth table, which are expected, and ends SOUND.
  Under the fix the model battery goes red on it. That gate prints verdict-shaped data, so the fix
  belongs there (say REJECT, not FAIL, for a table cell), not in an exemption here. The browser
  battery record (59 gates) has 0 gates affected. Both records are 17 days old.

**Not done, next step for whoever picks this up:** findings 5 to 10, starting with 9 (model gate,
fully runnable) and 7 (model-level predicates). Run the two probes and the mocked batteries first
to confirm nothing moved. The mock repo was built in a scratchpad: copy `run-battery.mjs`,
`run-browser-battery.mjs`, `assert-one-knob.mjs` and `lib/` into `<tmp>/scripts/verify/`, symlink
`node_modules`, add four children (PASS exit 0, FAIL exit 0, nothing exit 0, FAIL exit 1; the browser
set opens with an unreachable `playwright-core` launch so the classifier files them browser) and run
each runner with `--only=`.

**2026-09-22, second lane: finding 9 fixed at the instrument, copy NOT yet fixed.** Stopped at the
150k context line with one finding in flight.

| # | reproduced | fixed | Codex's mutation now red | real tree before, after | not verified |
|---|---|---|---|---|---|
| 9 | yes. The old gate on five scratch copies of the tree, each with one plant (`{"a — b"}`, `title="a — b"`, a template label, a `\u2014` escape, `<p>— Public sentence —</p>` outside the fence): 4 of 4 PASS, exit 0, on all five | yes, the gate now walks the TypeScript AST and reads every cooked literal; the divider allowance is read from the real `showDebug &&` fence and its declaration | yes, each of the five plants adds exactly one hit (115 against 114 at the time) | 4 PASS exit 0, now 6 PASS 1 FAIL exit 1: **116 em dashes in user-facing copy** across 15 files | copy not changed; no browser gate run |

- **The real-tree red is a finding, not a gate bug.** Toasts, tooltips, 27 fusion descriptions and 52
  strings on `/desk-doodles`. `curl` of `/desk-doodles` on :3105 held 48 em dashes in its SSR HTML.
- **A hole in my own first fix, caught by reading the allowed list:** "the dash alone" trimmed
  every literal, so two `${a} — ${b}` joins passed as placeholders. The glyph now has to be a whole
  literal; two canaries hold that.
- **Next step:** `node scripts/verify/_probe-crosscheck-emdash-copyfix.mjs` checks 117 decided
  rewrites (all found, exit 0). Read `/desk-doodles` with curl, run it with `--apply`, update the
  one probe that matches the old text (`_probe-video-route.mjs`, "Rendering the film —"), read the
  page again, and require the gate at 0. Then findings 7, 10, 5, 6, 8 and `assert-moment`, as briefed.

**2026-09-22 16:02, finding 9 copy applied: the gate reads 0.** I read all 117 rewrites in context
first and changed 9 of them, where the draft had left a stitched fragment or a list hanging off the
wrong noun (each keeps its draft under `prepared`). Colons now sit in 5 places, each before a list or
figures. `curl /desk-doodles` held 48 em dashes before and 0 after, and one of the changed strings
("The drawing is back, carrying") is in the served HTML, so hot reload took it. `/` held 0 before and
after. `assert-no-em-dashes` 7 PASS, exit 0, 0 across 123 files. The five Codex plants replayed in
memory against the clean tree: each adds exactly 1 blocking hit at its planted line. tsc: the 6
baseline errors (handFeel 1, geometry-engines 5). `_probe-video-route.mjs` now matches "Rendering the
film, N%". Not run: any browser gate, including `_probe-video-route.mjs` itself. The copyfix probe's
check mode now fails by design, since the old texts are gone.

**2026-09-22, third lane: finding 7 closed, finding 10 written and not yet proven. Stopped at the
150k context line.**

| # | reproduced | fixed | Codex's mutation now red | real tree before, after | not verified |
|---|---|---|---|---|---|
| 7 | yes, the old gate in a scratch repo on clones of the real `after` frames: 3 of 9 probe cases as expected, all four Codex mutations PASS at exit 0 | yes, `ab67a422` | 3 of 4. 7a, 7b, 7c red. 7d (`[0,10,0,8...]`) still PASSES the snap-back row: with the tautology gone, its earlier 10 step outweighs the 8 into the park. Pinned as OPEN in the probe, bar not moved | last record 09-05: 29 PASS exit 0. Today, before and after the fix: 1 FAIL exit 1, PROVENANCE, frames 407h older than `lib/implicit-surface.ts` | no recapture yet, so no verdict on the current tree |
| 10 | not yet at model level | edits in the working tree, UNCOMMITTED, `node --check` only | no | not run | everything |

- **7.** `_probe-crosscheck-timing-frames.mjs` runs the real gate, 9 of 9 on the fix. The untouched
  clone is 30 PASS exit 0 (29 before plus the new key-presence row). 7d is a ruling for Sebs, not a
  gate edit: is a park at 80% of the peak, after the curve returned to 0, a snap-back?
- **10, what is in the working tree of `assert-export-window.mjs`:** a `==PURE-BEGIN==` /
  `==PURE-END==` block holding `measureOrder` (a frame with no centroid is UNMEASURED and an
  unmeasured control fails the Q1 pair), `glbCheck` (glTF magic, version 2, declared length equals
  buffer, as a new Q4 row and inside the Q4 pair) and `vanishReachesInk` (each §D Vanish film must
  peak at 10% or more of the grow download's finished mark, `growMark`).
- **Exact next step:** write `_probe-crosscheck-export-window.mjs` that slices the PURE block out of
  the gate, prepends `createCanvas`/`loadImage` from `@napi-rs/canvas`, exports the names, imports it,
  and replays Codex's three mutations (every harness mask zeroed, `glb` returning "", every §D census
  at 0 ink) plus a healthy case for each. Reproduce the OLD predicates first from `git show
  ab67a422:scripts/verify/assert-export-window.mjs`. Commit 10 only when that probe is green on the fix
  and red on the old predicates. Then 5, 6, 8, `assert-moment`. The em-dash commit `681a0520` has
  landed; check `git status --short app components lib` is empty before any browser gate, then run
  `verify-timing-origin.mjs --label=after` headed (`FS_PORT=3105 FS_HEADED=1`) and re-grade 7 on
  fresh frames.

**2026-09-22, fourth lane: findings 10, 5 and 6 closed. Stopped at the 150k context line.**

| # | reproduced | fixed | Codex's mutation now red | real tree before, after | not verified |
|---|---|---|---|---|---|
| 10 | yes, all three pass on the `ab67a422` predicates | yes, `ee920c9c` | 3 of 3 | 09-05 record 37 PASS; today headed 39 PASS 0 FAIL (the order-only row added since, plus the new GLB byte row). Q1 control: 0 unmeasured frames. GLB 211684 bytes, glTF 2, x3 | GLB hash still not reproducible run-to-run, as on 09-05 |
| 5 | yes, frozen head passes on `ee920c9c` | yes, `d6f914a1` | yes | 25 of 25 before and after, same rows; sample 0.302 from 0.000 while playing | |
| 6 | yes, all three on `d6f914a1` | yes, `d9c7d595` | 3 of 3 | real `--only=bogus` exit 2; real `--only=flash` rewrote its 24 files, none of the other 172 | |

- Probes: `_probe-crosscheck-export-window.mjs` 12/12, `_probe-crosscheck-drawin-timing.mjs` 5/5,
  `_probe-crosscheck-timing-origin.mjs` 14/14. Each runs the gate's own text sliced by AST, old and new.
- ⚠ `docs/verification/timing-origin/after/completion_flash*` (24 files) and `video/after.webm` are
  fresh and UNCOMMITTED, sitting beside 172 frames that are 407h old. The full recapture below replaces all of it.
- **Exact next step:** finding 8 (`verify-register-light.mjs`: after orbit discovery, verify the
  transport state and the captured image content, and exit 1 on collected console or page errors;
  replay `scrubTo(0)` in place of `scrubTo(solidT)`). Then `assert-moment` (print expected-rejection
  cells as `PASS  KNOWN-BAD ... correctly FAILS`, verdicts unchanged, and prove a real FAIL still
  reads red under `failedAtZero` in `run-battery.mjs`). Then check `git status --short app components lib`
  is empty, run `FS_PORT=3105 FS_HEADED=1 node scripts/verify/verify-timing-origin.mjs --label=after`,
  then `assert-timing-frames.mjs`, and report its verdict on fresh frames. 7d stays filed as his ruling.

**2026-09-22, fifth lane: finding 8, `assert-moment` and the finding 7 re-grade closed.**

| item | reproduced | fixed | Codex's mutation now red | real tree before, after | not verified |
|---|---|---|---|---|---|
| 8 | yes. `scrubTo(0)` for the park exits 0 on `a14aa777`, on a fake page and live headed; the live mutant's 12 frames hold 0 ink pixels | yes, `1ba879b7` | yes, fake and live. Also red on the fix: a planted console error, and an orbit phase with a blank render | capture exit 0 before and after, now 12 frames with ink 0.67% to 2.62% against a 0.25% floor. `assert-register-light` headed: ALL PASS, exit 0, including `fsH.mean > ddH.mean * 1.4` at 132.53 vs 60.11 | the page itself under a console error (planted on the fake page only) |
| assert-moment | yes, `a14aa777` prints 25 FAIL rows at exit 0, `failedAtZero` true | yes, `ec4d42c8` | n/a (not a Codex finding) | before RED@0, after `run-battery --only=assert-moment` pass, 46 rows; truth table byte-identical. Planted hold jitter reads RED@0, planted 5\' failure exits 1 | |
| 7 re-grade | n/a | nit `5ff5b5dc`: `mkdirSync` after `--only` validation | 7a to 7c already red (`ab67a422`) | 09-05: 29 PASS. Fresh 196 frames, `app components lib` clean: 30 PASS exit 0. The 09-05 gate text on the same frames: 29 PASS, same row names; the 30th is the key-presence row. PROVENANCE green | 7d, his ruling |

- ⚠ **F106 reads differently today.** Its row passes at 132.53 vs 60.11 (bar 84.15), against the
  recorded 77.04 vs 77.08. Not touched, and one run is not a reproduction; F106 owns it.
- ⚠ **`run-battery --only=<x>` overwrites `docs/verification/gate-integrity/battery.json` with a
  one-gate record** (677 lines down to about 30). Restored by hand here. A filtered run replacing the
  full record is the same shape as finding 6. Not fixed, not mine.
- `verify-timing-origin` printed `UI controls present: []` (no `<select>` on the page). No gate row
  reads it; not checked against 09-05.
- Probes: `_probe-crosscheck-register-light.mjs` 8/8 fake, 4/4 `--live`;
  `_probe-crosscheck-assert-moment.mjs` 6/6.

**CLOSING, 2026-09-22.** Of Codex's ten findings, nine are closed with Codex's own mutation re-run red
against the fix: 1 to 6, 8, 9, 10, and 7a to 7c. **7d is his ruling** (is a park at 80% of the peak,
after the curve returned to 0, a snap-back?), pinned OPEN in `_probe-crosscheck-timing-frames.mjs`.
Never verified: Codex's "could not check" list as a whole, in particular any mutated product code
under a browser battery and the `--before` export snapshot wiring gap, which no lane has taken.

**2026-09-22 22:30, the `--only` wipe noted above is fixed, and both batteries were re-run in full.**
Row F115. A filtered run of either battery now writes `battery-only.json`,
`browser-battery-only.json` and `browser-logs-only/`, and leaves the full record alone (`dfdeceda`,
probe 15 of 15). Against 09-05: model 52/54 to 44/54, browser 53/59 to 50/59. Of the 14 verdicts that
moved, 10 are PROVENANCE rows that `681a0520` set off by rewriting source files that 09-05 captures
grade, 2 did not reproduce alone, and 2 went green. Every one is itemised in F115.

---

## 🔴 F114 - THE DISK IS AT 94% AND `~/lanes` IS 245 G OF PORTFOLIO LANES

**Measured 2026-09-22. It was 336 Gi free earlier in this same session and is now 56 Gi.**

| | size |
|---|---:|
| `~/lanes` (PORTFOLIO lanes, not this repo's) | **245 G** |
| `~/Desktop` (all ~24 repos, free-stroke is 14 G of it) | 217 G |
| `~/.fs-lanes` (this repo's lanes) | 107 G |
| `~/Library/Caches` | 19 G |

**34 portfolio lanes. Six have a live process; 28 are idle.** Biggest: `L-PILL` 11 G,
`L-DOODLESTYLE` 9.8 G, `L-SEATRACE` 8.6 G, `L-ABOUTSPREAD2` 8.5 G.

⚠ **Not touched, and not mine to touch.** These belong to the portfolio project, and the STATE
block's own rule says a dead worktree can hold modified tracked source. The `agent-worktree-hygiene`
skill covers exactly this failure, and his memory records it at **424 G** once before.

**What is prepared on this side:** F111 hands back ~90 G of `~/.fs-lanes` for one word, with every
unique byte already salvaged and verified. That alone takes the disk from 94% to about 84%.
**The other 245 G is a portfolio-side call.**


### 2026-09-22, evening: why the harness never cleaned up, and what was freed
Disk was **18 G free** by the evening. `~/.claude/hooks/sweep-workspace.py --dry-run` said **"would
free 0.0 GB"** while 24 orphaned portfolio worktrees sat at about 81 G. The cause: it decoded each
salvage diff as UTF-8 text, one non-UTF-8 byte threw, and the orphan branch correctly refuses to remove
what it could not read. So it refused all 24, and reported a clean zero. Silent-degradation, textbook.

**My first fix was wrong and cost 85 G.** I read bytes AND added `--binary`. An orphan diffed against
today's HEAD is mostly the inverse of later work, so each "patch" became a full copy of every render
that differs from HEAD: 13 to 9.2 G each, written into `portfolio/docs/` on the iCloud-synced Desktop.
Four empty-directory orphans produced 9.2 G patches that were **25,740 deletions and 0 other changes**,
the whole repo. Caught by disk going DOWN mid-sweep (39 G to 33 G free). Stopped, patches moved to
`~/lane-evidence/2026-09-22/orphan-patches-binary/`, text-only copies written beside them
(`orphan-patches-text/`, 7.2 G, every text hunk kept, binary files named). The four pure-deletion
patches (37 G) deleted by him. **The sweeper now reads bytes without `--binary`.**

Removed: 13 of 24 orphans, the eleven 09-04 lanes. **Disk: 316 G free.**

Still open:
- 14 binary patches, 51 G, in `orphan-patches-binary/`. Their text halves are kept. Recommendation to
  him: delete, since the evidence folder was already excluded and the rest is old versions of files
  main replaced. Needs his hand (the auto-mode classifier refuses irreversible deletes).
- 11 orphans left, taken by the next sweep (about 300 M of patch each now, not 4 G).
- `~/lanes`, 274 G: a portfolio session was live (8 lanes with processes, commits within the hour).
  Most of its 38 branches are NOT on portfolio `main` (up to 39 commits ahead). Landing them is that
  session's job. The portfolio session added `sweep_lanes` today, which archives idle lanes and keeps
  the branch.

---

## F115 - THE BATTERIES AFTER F113: 94 OF 113 GREEN, AND 10 OF THE 12 NEW REDS ARE STALE CAPTURES

**Measured 2026-09-22, 21:34 to 22:25, at `dfdeceda`, `app components lib` clean.** Load averages 15 to
28 throughout (a portfolio session was live). Browser battery headed on :3105 (`FS_PORT=3105
FS_HEADED=1`), no `--prod-port`, same as 09-05. The dev server is 4 days old; before the browser run
`curl /desk-doodles` served the 681a0520 string "The drawing is back, carrying" and 0 em dashes, so it
serves today's copy. That is a positive control on the copy only, not on `lib/implicit-surface.ts`.

**The `--only` fix first.** `run-battery --only=<x>` replaced the full `battery.json` with a one-gate
file, and `run-browser-battery --only=<x>` did the same to `browser-battery.json` and overwrote the full
run's transcript in `browser-logs/`. Filtered runs now write their own files, each carrying `filter`.
I did not merge by gate: one `when` and one set of counts over verdicts from different commits would
describe a full sweep that never ran. `_probe-crosscheck-battery-only.mjs`, 15 of 15: the 38dcf238
runners wipe a sentinel record (must-fail, red), the runners on disk keep it byte-identical, a filtered
run did write its own file, and an unfiltered run does replace the record. The probe also caught
`run-battery.mjs` exiting 0 with no sweep when invoked through a symlinked path (/var is a link to
/private/var): `IS_MAIN` compared a raw argv[1] with a resolved path. Both sides are realpath'd now.
The three single-gate re-runs below used the fix, and `browser-battery.json` was byte-identical after
them.

| | 09-05 | 09-22 |
|---|---|---|
| model | 52/54 green, 2 red | **44/54**, 10 red |
| browser | 53/59, 1 partial, 5 red | **50/59**, 1 partial, 8 red |

**Every verdict that changed, with its cause.**

| gate | battery | 09-05 | today | cause |
|---|---|---|---|---|
| `assert-timing` | model | pass | red | PROVENANCE. Frames from 09-05 15:00, `lib/style-fusion.ts` written 09-22 16:01 by **681a0520** |
| `assert-stack` | model | pass | red | same, 681a0520 |
| `assert-stack-anim` | model | pass | red | same, 681a0520 |
| `assert-material-craft` | model | pass | red | same, 681a0520 |
| `assert-pentip-specks` | model | pass | red | same, 681a0520 |
| `assert-fusion-two-dead` | model | pass | red | same, `app/page.tsx`, 681a0520 |
| `assert-hero-carve` | model | pass | red | same, `app/page.tsx`, 681a0520 (both `carve` and `carve-prior` arms) |
| `assert-fusion-combo-liveness` | model | pass | red | its own capture-age row names `lib/style-fusion.ts`, `components/style-panel-scaffold.tsx`, `app/page.tsx`, all 681a0520 |
| `assert-form-orbit` | browser | pass | red | PROVENANCE, frames 09-05 15:51, `app/page.tsx`, 681a0520 |
| `assert-gloss-rim` | browser | pass | red | PROVENANCE, `geometry/es-after/report.json` 09-05 15:52, 681a0520 |
| `assert-moment` | model | RED@0 | pass | **ec4d42c8** prints expected rejections as `PASS KNOWN-BAD`, truth table unchanged |
| `assert-register-light` | browser | red | pass | **unknown**, see F106 below |
| `assert-hero-switch` | browser | pass | red | `console clean`, 1 error. **Passed 10/10 alone** at load 11. The gate prints the count and not the message, so what the error was is unknown. Consistent with load, not proven |
| `assert-pen-carve` | browser | pass | red | `page.goto: Timeout 30000ms exceeded` at load ~20. **Passed 7/7 alone in 11 s.** Load |
| `assert-drawin-pentip` | model | red | red | Same verdict, different reason. 09-05 red on the F91 nib row (48 rows, 1 fail). Today 1 row: PROVENANCE, frames from 14:25 (after ee2fb376) are 1.6 h older than 681a0520. **Its nib verdict was not measured today** |

None of the 10 PROVENANCE reds is a finding about the drawing. 681a0520 changed strings, and the gates
compare file times, so they cannot tell a copy edit from a geometry edit. That is the gate doing its
job; the fix is recapture, not a relaxed row. None was recaptured here.

**Gates red both times, rows read:**
- `assert-elbow` 49 rows 18 fail to 48 rows 16 fail. **ROUTE-8 PASS**, `nonManifold 0` (ee2fb376).
- `assert-mode-rims` 190 rows, 7 fail, unchanged.
- `assert-hero-k7-intact` 8 rows, 3 fail, unchanged.
- `assert-hero-transition` 16 rows, 1 fail. The number moved: **cx step 2.00 px against `< 2`**
  (STATUS had 2.50), contact **0.00** (STATUS had 1.00), common-mode 0.00. Not investigated.
- `assert-screen-layers` (model) 2 rows, 1 fail, now PROVENANCE: `REFUSED-asc_flicker` capture from
  09-05 10:43 against `lib/style-fusion.ts`. The Δ 4.611 row is not reached today.
- `assert-debug-surface-fenced` PARTIAL, as on 09-05 (no `--prod-port`, F104).

**Known reds from the STATUS morning list that are green today:** `assert-citations` 17 rows, 0 fail
(green since F101 on 09-05). `assert-drawin-timing` 25 of 25 at load 15 to 28, which F108 said goes
red under load. One run; F108 is not closed by it.

**F106, `assert-register-light`, is now 3 of 3 at the same number.** The gate launches its own browser
(`:256`), so each run is live. Fifth lane, this battery, and alone: `fs.headon` mean **132.53**, `dd.headon`
**60.11**, bar 1.4x = 84.15, pass. On 09-05 it was 77.04 against 77.08. The only product commits between
the two records are ee2fb376 (`lib/implicit-surface.ts`) and 681a0520 (strings). F106 already records
this value moving with no code change (132.78 on 08-28, 77.04 on 09-05), so I cannot pin it on
ee2fb376 without reverting it, which this lane may not do. Cause: unknown.

**Not checked:** a recapture of any of the stale arms, so none of those 10 gates (nor `drawin-pentip`) has a verdict on
the current tree. `--prod-port`, so the fence stays PARTIAL. What the `hero-switch` console error said.
The hero-transition number change. A second quiet run of `drawin-timing`. Anything under `lib/` served
by the 4-day-old dev server beyond the copy control above.

**Evidence:** `docs/verification/gate-integrity/battery.json`, `browser-battery.json`,
`model-battery-2026-09-22.log`, `browser-battery-2026-09-22.log`, `browser-logs/` (full run),
`browser-logs-only/` (the three single-gate re-runs).

**Next step:** recapture the stale arms of those 10 gates plus `drawin-pentip`, one capture at a time with no battery running, using the
command each PROVENANCE row names (`verify-timing.mjs`, `verify-stack.mjs`, `verify-form-orbit.mjs`,
`verify-hero-transition.mjs --label=carve` and `--label=carve-prior --carve=prior`,
`_probe-fusion-two-dead.mjs --label=v3`, `_probe-pentip-shape.mjs --label=ship-dsf1 --dsf=1`, and the
rest from `model-battery-2026-09-22.log`), then run those gates with `--only`, including
`assert-drawin-pentip` for its nib row. Then the STATUS prose, NOT done by this lane (stopped at
the 150k line): rewrite "WAITING ON YOU" to list only the round-pen elbow/rims predicates after the
nib fix, finding 7d (is a park at 80% of peak, after the pulse returned to 0, a snap-back?), the
hero-transition centroid bar (now 2.00 against `< 2`), F106 (132.53 against 84.15, 3 of 3 today,
cause unknown), the screen-layers pair, and the two housekeeping words still open: "drop the stash"
(`stash@{0}` is still there) and "merge v0, keep the logo" (origin is still 2 ahead). Remove "delete the
09-04 lanes", done today (F114). Add an "IF YOU JUST WOKE UP, 2026-09-22" block with the table above.

**2026-09-22, 22:29 to 23:25, the recaptures. Evidence in `90015613`, `4385e53d`, `85342001`.**
One capture at a time on :3105, headed, no battery running, load 17 to 42 (the portfolio session).

**Freshness first.** `_probe-nib-manifold.mjs --aspects=1.8` read `probe census (page) nonManifold 0`,
engine audit and both welds 0 too. The old code read 14 there, so the 4-day-old server is serving
ee2fb376. That is a positive control on `lib/implicit-surface.ts`, not on every file.

| gate | 09-05 | 09-22 battery | after recapture | capture |
|---|---|---|---|---|
| `assert-timing` | 15/15 | PROVENANCE red | **15/15** | `verify-timing.mjs` |
| `assert-stack` | 12/12 | PROVENANCE red | **12/12** | `verify-stack.mjs` (frames byte-identical) |
| `assert-stack-anim` | 10/10 | PROVENANCE red | **10/10** | `verify-stack-anim.mjs` |
| `assert-material-craft` | 13/13 | PROVENANCE red | **13/13** | `verify-material-craft.mjs --phase=presets` (byte-identical) |
| `assert-pentip-specks` | 31/31 | PROVENANCE red | **red, 1 row** | `_probe-pentip-shape.mjs --label=ship-dsf1 --dsf=1`, twice |
| `assert-fusion-two-dead` | 12/12 | PROVENANCE red | **12/12** | `_probe-fusion-two-dead.mjs --label=v3` |
| `assert-hero-carve` | 12/12 | 2 PROVENANCE reds | **12/12** | `verify-hero-transition.mjs --label=carve`, `--label=carve-prior --carve=prior` |
| `assert-fusion-combo-liveness` | 15/15 | capture-age red | **15/15** | `_probe-fusion-combo-liveness.mjs --label=run`, 120 cells |
| `assert-form-orbit` | 8/8 | PROVENANCE red | **8/8** | `verify-form-orbit.mjs --label=after` |
| `assert-gloss-rim` | 16/16 | PROVENANCE red | **16/16** | `geometry-baseline.mjs --save=es-after` |
| `assert-screen-layers` | red, WARN Δ 4.611 | PROVENANCE red | **red, WARN Δ 4.760** | `verify-screen-layers.mjs --label=c2` |
| `assert-drawin-pentip` | red, 1 of 48 | PROVENANCE red | **red, 1 of 48** | `_probe-pentip-sweep.mjs --label=run` |

- **pentip-specks is a real red, not provenance.** Row: *the PRIOR divisor leaves LESS antialiasing on
  the same boundary*, `t160-aaprior 11401 px of AA band vs t160 11398 px`. Same numbers on both fresh
  captures, so it is not load noise. The t275 pair of the same row passes (11370 vs 11397). The first
  capture also failed the NULL row on t275 (blank-spot -0.63 against 0.42, one 112 px hole at k=155);
  the second did not reproduce it. Cause not investigated. 09-05 frames predate ee2fb376 and 681a0520.
- **drawin-pentip is back to its 09-05 red, on the same row with the same number:** F85's
  `CONTROL: the PARKED PRIOR still reads as a CUT`, pen score **1.321** against `< 0.5`.
- **screen-layers did NOT refuse** (F110 expected it might). It warned 16 times that the viewport moved
  from y 92 to y 132 under the crop and kept the startup rectangle, then graded. 0 hard failures, 1
  warning: `fineGrain` vs `brushedSteel` on rod, same rail, Δ **4.760**. The crop caveat stands: the
  top 40 px of the graded bed sits above the viewport after the move (bottom edge 950 both times).
- **Model battery re-run in full** after the recaptures: **51/54 green**, the three above red.
  `model-battery-2026-09-22-recapture.log`, `battery.json`.
- **assert-hero-switch, alone, twice:** 10/10 both runs, `console clean 0 errors`. Run under a
  scratchpad `--import` preload that attaches `console`, `weberror` and `requestfailed` listeners to
  every context the launcher opens; the preload printed nothing. Positive control on the preload: a
  page with a planted `console.error` and a planted throw, both printed. **So the battery's one error
  has no text on record, and no alone run has reproduced it (12 of 12 clean now).** The gate stores
  the count only; nothing edited.
- **assert-hero-transition, alone, twice:** live capture into `hero-transition/bare`, 15 PASS 1 FAIL
  both times, `max cx step 2.00 px (needs < 2), CONTACT 0.00, COMMON-MODE 0.00`. **Today's is 2.00 /
  0.00 / 0.00, deterministic.** The 2.50 / 1.00 in STATUS came from the 09-05 frames.

**Battery-equivalent totals:** model **51/54**. Browser **52/59**, 1 partial, 6 red (09-22 full run
plus form-orbit and gloss-rim now green). hero-switch and pen-carve are among the 6 but pass alone
(12/12 and 7/7); counted as green on the alone runs it is 54/59. Together: **103 of 113** strict,
105 counting the alone runs.

**Not checked:** a full browser battery after the recaptures. The pentip-specks AA row's cause. What
the hero-switch battery error said. `--prod-port`, so the fence stays PARTIAL. Any server freshness
beyond `lib/implicit-surface.ts`.

**Next step:** STATUS prose updated in the same commit as this note. Open for a lane: why
`t160-aaprior` now carries 3 px more AA band than `t160`.

## F116 - THE pentip-specks AA RED IS THE GATE COMPARING TWO MEDIANS OVER DIFFERENT FRAMES

**Verdict: (b), a knife-edge row, with the mechanism found.** The drawing did not change the way the
red says. Frame for frame, `t160-aaprior` carries LESS AA band than `t160` on **178 of 178** shared
frames, mean **-26.0 px** (09-04: 178 of 178, mean -28.5). The effect is intact and about the same size.

**Why the row reads +3 anyway.** The row is `lo.medGrey < hi.medGrey`, two medians, no margin. Each
median is taken over that arm's own `body`, and `body` keeps only frames where a tip window was found
(`r.bad`). On frame **k=61** `t160-aaprior` finds no tip window and `t160` does, so the prior arm's
median is over 178 frames and the fixed arm's over 179. The medians sit one order statistic apart, and
the growing word makes neighbouring order statistics differ by 3 to 36 px, the same size as the effect.

| capture | t160 body | t160-aaprior body | gate medians | medians on shared frames | paired |
|---|---|---|---|---|---|
| 09-04 (aef6f937) | 179 | 178, k=61 dropped | 14235 vs 14263, pass by 28 | 14235 vs 14266 | 178/178 lower, -28.5 |
| 09-22 (90015613) | 179 | 178, k=61 dropped | 11401 vs 11398, FAIL by 3 | 11401 vs 11428 | 178/178 lower, -26.0 |

On 09-04 the dropped frame happened to cost 3 px (14263 vs 14266 at t160's middle). Today it costs 30
(11398 vs 11428). The row passed by luck of where the order statistics fell. The t275 pair has no
dropped frame and passes both days (-35, -27).

**Noise.** 3 headed repeat captures on :3105 (`_probe-pentip-specks-noise.mjs`, six arms, dsf 1),
plus F115's two: medGrey spread **0 px** on every arm across 5 captures. Frames byte-identical
201/201 on every arm run to run, except one frame (t160-aaprior k=70) on run 3. So the 3 px is not
noise; it repeats exactly. It is the instrument's frame bookkeeping, and the capture is near-deterministic.
The one flipped frame is also the likely shape of F115's one-off NULL failure on t275 (a single
112 px hole at k=155 that did not repeat). It did not repeat in any of my 3 runs either.

**Can today's commits reach it.** The capture is `/desk-doodles`, register desk-doodles, `inflate`
with `HERO_INFLATE.fusion: "implicit"`, so the free-stroke arms ARE marching cubes and **ee2fb376 can
reach them**. It cannot explain this red: the two arms of a pair share one geometry and differ only in
a shader uniform, and the paired effect is intact. 681a0520 is strings; the crop is `[data-hero-stage]`,
and the frames show only grid and ink, no text.

**What else changed since 09-04 that the capture sees.** The whole frame changed: areal half-width
5.59 to 8.38 px, AA band 14256 to 11396, grid lines luma 235 to 244, about 74 % of the "AA band" is
grid far from ink. Candidates, none isolated: Chrome updated to 153.0.8010.48 (09-15) and .53
(09-21); the 09-04 capture ran on its own server on :3116 and today's on the 4-day-old :3105, headed;
and 13 source commits under lib/ components/ app/ since aef6f937 (ee2fb376, 681a0520, a4c83618,
945f7e62, bf04db03, 3026b930, c103c83d, f6e8bb72, 277eac9e, 04404205, f96dfb2f, a9f7c086, 96db6dc5),
which read as strings, comments, DOM chrome and ortho-only framing apart from ee2fb376. The gate file
is unchanged since aef6f937 and reproduces the 09-04 numbers exactly on the 09-04 frames.

**Proposed fix, not applied (the gate is not this lane's).** Grade the AA row the way the rest of the
file grades everything: PAIRED over the frames both arms share, by the sign test the file already has
(`paired(out[prior].body, out[arm].body, r => r.grey)`, pass when z <= -KNOWN_BAD_Z or similar, here
z = -13.3). A principled margin, if a median is kept: compare medians over the SHARED frame set only,
and require the gap to exceed the largest neighbouring order-statistic gap at the median (36 px on
today's t160), which the effect (26 to 38 px) does not clear reliably. So the paired test is the
honest one. This does not relax anything: on today's frames it passes 178/178 and would fail an arm
where the divisor stopped mattering. Also worth a row of its own: why k=61 finds no tip window on
the aaprior arm on both days.

**Is it his call?** No. No bar moves and no taste is involved. It is a gate repair for a lane that
owns `assert-pentip-specks.mjs`, so no STATUS line.

**Not checked:** a headless capture, which would separate Chrome/headed from source as the cause of
the 09-04 to 09-22 frame change. A capture at a pre-ee2fb376 tree (lib/ may not be touched). Why
k=61 has no tip window. The four arms left out of the noise runs (t240, t310, free-stroke-off,
desk-doodles).

Evidence: `docs/verification/pentip-specks-noise/summary.json`, probe
`scripts/verify/_probe-pentip-specks-noise.mjs`. Frames and gate logs stayed in the lane scratchpad.


### 2026-09-22, later: FIXED as proposed
`assert-pentip-specks` grades the AA row paired now: `paired(prior.body, arm.body, r => r.grey)` must
read `z <= -NOISE_K` (the same 2 the detached-pieces rows use; no bar moved). On today's capture:
t160 pair **178 of 178** less, z = -13.34; t275 pair **179 of 179**, z = -13.38. Exit 0, 0 FAIL lines.
**Known-bad:** the same gate with the arms swapped reads more on 178 of 178 and 179 of 179,
z = +13.3, both rows FAIL, exit 1. The medians stay in the detail text. Still open: why k=61 finds no
tip window on the prior arm, and the frame-wide change since 09-04.

---

## F117 - NEXT SESSION'S QUEUE, WRITTEN 2026-09-23 AT THE END OF THE 09-22 SESSION

**State at handoff.** HEAD after `2ff6eba8`, `main` level, nothing pushed (origin is 2 ahead, see
F112). Nothing running: no lanes, no gates, no test Chrome. Dev server up on :3105, 5 days old, proven
to serve today's `lib/implicit-surface.ts`. Disk 334 G free. Gates: **104 of 113 green**, 106 counting
`hero-switch` and `pen-carve`, which fail only inside a loaded battery and pass alone every time.

**What the 09-22 session closed**, so nobody reopens it: F91 (the manifold fix, ee2fb376), F113 (the
Codex crosscheck, ten findings, only 7d open and it is his), the em-dash gate and copy (07e3411e,
681a0520), F114 (the sweeper decode bug and the disk), F115 (the battery `--only` wipe, dfdeceda, and
the recaptures), F116 (pentip-specks graded paired, 2ff6eba8).

**The queue, in this order. One lane for 1 and 2, it is a small batch.**

1. **Full browser battery**, headed on :3105, quiet machine. Not run since the recaptures, so the
   52/59 in STATUS is stitched from single-gate runs. Compare every verdict with F115's table. Any
   change needs a cause: a commit, load (re-run it alone, F108), or unknown.
2. **Finish the orphan sweep.** `python3 ~/.claude/hooks/sweep-workspace.py --dry-run` first. 11
   portfolio orphans are left. Each salvage patch must now be about 300 M of text, not 4 G. If free
   disk goes DOWN during the real run, stop it: that is how the 09-22 `--binary` bug showed itself.
   Portfolio's `~/lanes` is its own session's to land and retire, not this repo's.
3. **Why every pentip frame changed since 09-04.** Half-width 5.59 to 8.38 px, grid luma 235 to 244,
   AA band 14256 to 11396. Candidates in F116: Chrome 153.0.8010.48 on 09-15 and .53 on 09-21, headed
   on the old :3105 server against its own server on :3116, and 13 commits. One headless capture on
   today's tree separates Chrome and mode from source.
4. **Why frame k=61 finds no tip window on `t160-aaprior`.** Harmless since F116, still unexplained.
5. **The 08-07 lane copies** in `~/.fs-lanes`, about 9 G in 30 dirs plus `laneZ` 6.8 G, never checked
   for unique work. A first pass on 09-22 was thrown out because its dedupe join matched nothing.
   Method that works: hash every file with `git hash-object`; a file is unique only if its hash is in
   neither the repo's objects, nor the main checkout, nor `_salvage-2026-09-04`. Paths with spaces
   break an awk `$3` split, so use NUL-separated lists. Not urgent at 334 G free.

**His, not queue work:** the eight lines in STATUS "WAITING ON YOU". Nothing above depends on them.

**Cost note.** The 09-22 session ran 13 lanes at 150 to 170 K tokens each. Every one stopped at the
150 K line and wrote its next step into its row before stopping, which is why this handoff is short.
Keep that.


### 2026-09-24, 18:08 to 19:00: items 1 and 4 done, 3 half done, 5 not started (stopped at the 150k line)
At `14cabd96`, `app components lib` clean, fresh dev server on :3105, Chrome 153.0.8010.53 (same as
09-22). Load 7 to 22 (the walkthrough fan-out).

**Item 1. Model 50/54, browser 54/59 (1 partial, 4 red). Strict 104 of 113, the same total as the
09-22 handoff, with different gates in it.** Logs `gate-integrity/model-battery-2026-09-24.log` and
`browser-battery-2026-09-24.log`, records `battery.json` and `browser-battery.json`.

| gate | battery | 09-22 | today | cause |
|---|---|---|---|---|
| `assert-pentip-specks` | model | red | pass | **2ff6eba8**, F116's paired AA row |
| `assert-material-craft` | model | 13/13 | red, 6 rows | **iCloud conflict copies, not code.** `material-craft/presets/` holds 84 untracked `* 2.png` files byte-identical to their originals, and the gate reads `ceramic 2` as a preset that collapses onto `ceramic` (distance 0.0). Same frames with the copies left out, in a scratch folder: **13/13, exit 0** (`f117/material-craft-without-conflict-copies.log`) |
| `assert-citations` | model | 17/17 | red, RATCHET | **A sibling repo, not code.** `missing` rose 17 to 20. `~/Desktop/Projects/desk-doodles/docs/desktop-strays/` appeared 09-23 00:38 with second copies of `DeskDoodlesHome.tsx` and `Stroke3DScene.tsx`, so those 3 citations resolve AMBIGUOUS in the sibling and fall through to MISSING. No Free Stroke file changed |
| `assert-form-orbit`, `assert-gloss-rim` | browser | red | pass | the 09-22 recaptures (4385e53d) |
| `assert-hero-switch`, `assert-pen-carve` | browser | red | pass | load, F108: they pass in a battery at load 7 to 9 as they did alone |

Unchanged: model reds `drawin-pentip` (1.321), `screen-layers` (Δ 4.760). Browser reds `elbow` 48/16,
`hero-k7-intact` 8/3, `hero-transition` 16/1 (cx 2.00, contact 0.00, common-mode 0.00), `mode-rims`
190/7, fence PARTIAL. `register-light` passes at fs.headon **132.53**, dd.headon 60.11 (4 of 4 now).

**853 untracked iCloud conflict copies** (`* 2.*`) sit under `docs/verification/`, not only in
draft-taper: form-orbit/after 576, material-craft/presets 84, draft-taper/run 72, joint-beading/run
108, hero-transition/carve-prior 8, 5 singles, plus empty `pentip/ship-dsf1 2/`, `pentip/run 2`,
`run 3`. One is tracked: `geometry/sp_before/closedO_extrude 2.png`. Nothing deleted. Any gate that
lists a folder can read them; material-craft is the one that did today.

**Item 4. k=61 is the frame where a stroke has finished and the next has not started.**
`tipWindow` needs a pixel that is ink now and was not ink one frame ago. Probe
`_probe-f117-k61.mjs`, same mask rule as the gate: on `t160-aaprior` the new ink runs 201, 113, 8,
**0**, 562 over k=58..62 (09-22 frames) and 199, 109, 13, **0**, 552 (09-04). k=62's new ink is a
new stroke starting top right. I looked at 5x crops (`f117/k61-crops-*.png`): the lower stroke of the
letter has reached the diagonal and stopped. `t160` gets its k=61 window from **1 pixel** (3 on 09-04)
on a thin light seam where the fixed-divisor arm's stroke butts into the diagonal; the aaprior arm
draws no seam there, so nothing changes. Neither arm has a pen at k=61. So the drop is correct and the
kept window on t160 is a seam flicker. Side finding, not investigated: that seam is visible on t160 at
k=60 to 62 on both days and absent on aaprior.

**Item 3, half.** Frames from git (09-04, aef6f937) against 09-22 (90015613), `_probe-f117-frame-stats.mjs`:
paper 250 both; grid luma (mode in paper-30..paper-2) **240 to 244**; ink 19022 to 18021; gate AA band
14244 to 11382; of that band, pixels more than 12 px from any ink **10786 to 8442**. So 2344 of the
2862 px drop is grid, far from ink. Gate medW 5.59 to 8.38 reproduced on both sets. **Key fact for the
headless run:** the capture calls `chromium.launch()` with no `headed`, so without `FS_HEADED=1` it
runs HEADLESS (`lib/browser.mjs`), and nothing records that the 09-04 lane set it. Chrome is .53 today
and was .53 on 09-22, so a headless capture today separates MODE only.

**Next step, exactly:**
1. `FS_PORT=3105 FS_HEADED=0 node scripts/verify/_probe-pentip-shape.mjs --label=f117-headless --dsf=1 --only=free-stroke,chisel,t160,t160-aaprior,t275,t275-aaprior`,
   then the same with `FS_HEADED=1 --label=f117-headed`. Grade each with
   `assert-pentip-specks.mjs --dir=docs/verification/pentip/<label>` and run
   `_probe-f117-frame-stats.mjs --dir=` on each. Headless at 240 / 5.59 means mode; at 244 / 8.38 means
   Chrome or source, not separable at `.53`.
2. Item 5: `python3 docs/verification/f117/lane-audit.py --out=<scratchpad>/lane-audit.json`. It hashes
   in Python as `git hash-object --no-filters` does (os.walk, so no path split), skips node_modules
   .next .git symlinks, and refuses to report if its self-test fails (hash equals git's on files with
   spaces; package.json reads KNOWN; a scratchpad file reads UNIQUE). Not run yet. `battery-0828` has
   its own `.git`: check its commits against main separately.

---

## F118 - EVERYTHING IS GARBAGE UNTIL HE SAYS OTHERWISE. THE WORK, IN ORDER, FROM 2026-09-24

His ruling, verbatim: *"Let's reframe this. I'm going to assume everything's crap. Go into this
thinking everything's absolute garbage, bottom of the barrel"*. Also today: *"we've been working on
this off and on for about a month now. No change whatsoever. Everything looks equally as shit,
smeared all over the place"* and *"There needs to be things for grading, for evaluations, all this
other stuff that makes our grading and our checking airtight."*

**Read first, in this order:** `docs/complaints/LEDGER.md` (640 of his complaints, 07-04 to 09-24,
top-15 Free Stroke table at the end), `docs/hero-defects-2026-09-24.md` (four hero defects, half
mapped to code), and the film `docs/verification/hero-beat-film/2026-09-24-look/` (frames by phase:
draw 0-462, emerge 603, solid 725, standup 803, orbit 932, returnTurn 1060, hold 1146).

**What the controller saw today, by eye:** white specks inside both "e"s and a white bar on the
Doodles "D" in the resting frames (1130, 1250); white ghost outlines down D, o and l in the return
turn (1115); each letter turning on its own axis and piling into its neighbours (1085 to 1115); the
"es." ending a squashed zigzag fused with the period; debug text (`raw 0 pts | processed ...`) on
the product page; every animation control present but only behind the small "Timing" button, which
appears only after a stroke is drawn.

**The order:**
1. **The eye first.** Reference frames from the two things he praised (the original Free Stroke 3D
   draw-in, the Desk Doodles draw-in) plus one check per defect, each shown FAILING on today's film
   before anything is fixed. Judging uses `pairwise-visual-judging`: which of two is better against
   a locked reference, never a 0-10 score. His 09-13 ask: *"some sort of script where you run
   through and it checks what you did and flags it so you can't come back and just go have it
   created and say it's done."*
2. **The turn and its white ghosts, together.** `lib/hero-motion.ts:2454-2497`; its own comment
   records a "white crack" at the joins whenever letters do not share a pivot. Likely one cause.
3. **The draw-in**, against Desk Doodles frame by frame. R1's defects: 9 of 22 strokes shorter than
   the nib, every pen lift a fixed 60 ms, the hand squeezed 3.60x.
4. **The resting white specks**, then **the S**.
5. **The animation panel**, findable before a stroke exists, and the debug text off the product page.

**Every step ships as a before and after film the controller has watched, put in front of him. The
row stays OPEN until he says it looks right.**


### F118 HARDEN-A note, 2026-09-26: NOT MERGE-READY. Three of the seven Codex crosscheck findings are fixed, each with its must-fail shown firing. Undock, the drift and delete exit codes, the look section verdict and the width-keys header are not started. The lane hit its context line before the browser step.

Done on `lane/hardenA`, one commit per file:

- `5cd306bb5` **assert-camera-moves.** Samples go through `at()`, which refuses a non-finite value by name, and every stillness and speed comparison is written `!(x <= bar)`, LANDS too. New mutant in `lib/keyframes.ts`: sampleTrack returns NaN for camera tracks, with the drawProgress read left alone. My first try broke the clock as well, so the rows went red from a throw somewhere else and proved nothing. On the old rows the mutant is MISSED, 0 of 3 red. On the new rows it is CAUGHT, 3 of 3, each reading "sampleTrack gave NaN at 0 ms". 10 of 10 rows, 17 of 17 mutants (was 16), exit 0.
- `1e16604bc` **_probe-customize-leaks.** Every return in a control is walked, early ones inside an `if` too, and a return that hands back a variable exits 3 (UNREAD RETURN). Fixture with a leak in an early return: old exit 0, new exit 1, `p@9`. Fixture that returns a const: old exit 0, new exit 3. The real scaffold reads the same as before: 7 controls, 7 returns, 72 Field wrappers, 0 leaks.
- `307c7e319` **_probe-customize-coverage.** A Field counts only when a reachable return gets to it, parsed with TypeScript. Fixture hiding 4 dither keys behind `false &&`, a comment, an unused const and code after the return: old 9 of 9, exit 0; new 5 of 9, exit 1. Positive fixture: 9 of 9 Fields reached across seven shapes. Real scaffold: 12 families covered, 72 of 72 Fields reached, exit 0. The header and every run state the limit: it reads source, and `assert-custom-presets` checks the rendered list ("Customize lists exactly presetFields") for the first dither preset only. No other family has a rendered check.

Left for the next lane:

- **undock.mjs.** Before writing the checks, read the DOM once on :3139. All six callers (custom-presets, key-lanes, perform, stroke-timing-browser, stroke-strip, customize-delete) call undock before any stroke lands, so it must be confirmed that `[data-take-dock] > :has([data-take-timeline])` already exists at that point. Then read back that the child matched, its computed position is absolute, the host's bottom padding is 0, and the canvas fills the host's content box within 1 px (its header says 755x890 at 1512x982). Throw naming whichever failed. Must-fail: a `setContent` page with the host and no child.
- **drift and delete.** Set a nonzero exit on a failed control or any MOVED arm. The in-page differ has a second hole: two grabs of different sizes compare only up to the shorter buffer, because NaN is falsy, so a size change can read as SAME. Delete needs the gate's predicate: the preset is gone, one canvas size, and the same hash with the panel shut. Prove both with a named env arm on the real page.
- **look.** Zero systems, zero shown systems, or a shown system with no fields must fail the section verdict.
- **assert-width-keys.** Write the SIGS limit (same engine as the bench) and the THROTTLE limit (it cannot see the viewport rebuild or GPU upload) into the header and the row text. Comments only.
- Not run here: tsc (only `.mjs` files changed; the baseline of 6 was not rechecked). No dev server or browser was started, and no `.next/` exists.

Instrument note: a `timeout 120 node ... | grep` check printed nothing because `timeout` is not installed on this Mac and the pipe hid the error. zsh has no `PIPESTATUS` either, so every exit code above was read without a pipe.


### F118 HARDEN-A2 note, 2026-09-26: undock DONE. Drift DONE. Delete BUILT, and its clean run exits 1 on a real canvas resize, so it is not green.

On `lane/hardenA`, on top of `ffc8ee1d7`:

- `fbf6223d3` **undock.mjs.** The plan's premise was wrong, and the page said so first. Read on :3139 at 1512x982: when the host attaches, `[data-take-dock] > :has([data-take-timeline])` does not exist. The host holds two children, the canvas wrapper (relative) and an overlay (absolute), and zero take strips. The panel mounts as a third child only once strokes land. So undock now checks in two steps. Before it returns: the host's computed padding-bottom is 0 (the stylesheet landed), and the host's canvas fills the host's content box within 1 px, and is 755x890 within 1 px at 1512x982. When the take strip first mounts: the panel selector matched, its computed position is absolute or fixed, and the canvas still passes. A miss there closes the page with the reason, so the caller's next page call throws with it, and sets exitCode 1. At 1440x900 (stroke-timing-browser) main's size is not recorded, so only the fill check applies there. Must-fail through the delete probe, both exit 1 by name: `UNDOCK_MUTATE=css` throws "the stylesheet did not land ... padding-bottom 64px"; `UNDOCK_MUTATE=selector` throws "the panel selector ... matched nothing when the take strip mounted; canvas 755.5x597.3 does not fill the dock host's content box 756x890". Positive: `assert-perform` logs "[undock] host floated: canvas 755.5x890" and "[undock] panel floated: position absolute, canvas 755.5x890", then reaches row 8. Row 8 FAILs on "base-main.json missing: run --phase=base against main", which is the gate's missing base, not undock. The gate was not graded. Limit, written in the header: a page where no take strip mounts never checks the panel, and says nothing.
- `258fd2d7b` **drift.** Any MOVED arm or a FAIL positive control sets exit 1, with an EXIT line naming each. The differ returns DIFFERENT SIZE when the grabs differ in size. The old loop, run in node on a 4x3 against a 4x2 of the same pixels, reads n=0, SAME, because the missing tail is NaN and NaN is falsy. A self-test at start diffs a grab against itself one row short and throws unless it reads DIFFERENT SIZE; it read "DIFFERENT SIZE 755x533 vs 755x532". The positive control now diffs against the arm's first grab, which no mutant touches. Clean run: exit 0, every arm SAME, control 1527 px. `DRIFT_MUTATE=moved`: exit 1, "MOVED untouched", control PASS. `DRIFT_MUTATE=fail`: exit 1, "FAIL positive control". `DRIFT_MUTATE=size`: exit 1, "MOVED untouched ... DIFFERENT SIZE 755x533 vs 755x532".
- `258fd2d7b` **delete.** Four rows, exit 1 on any FAIL: PRESET GONE, DID NOT RESIZE with the Presets panel open, DID NOT RESIZE with it shut, PICTURE UNCHANGED (the same hash with the panel shut, after delete against before delete by undo). Sizes are compared only at one panel state, because the panel alone takes the canvas from 890 to 449. `DELETE_MUTATE=resize` (viewport to 1512x900 before the undo): exit 1, "after delete 755x890, before delete (undo) 755x808". `DELETE_MUTATE=picture` (ditherScale 3 after the undo): exit 1, "bc1e6df2dd533dc5 vs d242301e16a671c3". Both fail a row the clean run passes.

**BLOCKS the delete positive.** The clean run exits 1: "FAIL DID NOT RESIZE, open: 10 reads, 8 not 755x449". With the Presets panel open, the delete removes the Customize section, the panel gets shorter, and the canvas grows from 755x449 to 755x627 within 120 ms and stays there. Shut, both sides read 755x890 and hash bc1e6df2dd533dc5. That is the probe's own question answered yes. I did not loosen the row. Whether the bar should be the panel-shut pair only is a call for whoever owns the gate's predicate; I did not read the gate.

Not run: tsc (only `.mjs` changed). Dev server on :3139 was this clone's, killed by pid; `.next/` deleted. The look probe and the width-keys header are left for the later lane.

### F118 HARDEN-A3 note, 2026-09-26: delete DONE. Look section verdict DONE. Both probes exit 0 clean and exit 1 on every must-fail.

On `lane/hardenA`, on top of `0ce21b6d0`, both in `5d397bfb2`:

- **delete.** The panel-open row asked whether the canvas kept its size, and with the panel open the delete resizes it on purpose. The row is now SETTLED TO NO-PRESET SIZE, open: after the delete the held size is real (never "none" or "unsettled"), reads the same again after the grab's 600 ms, and equals the size a REFERENCE ARM measures. The reference is a fresh context at 1512x982 with the same strokes and dither p0, then `setStyle({ activePresetId: null })` in place of a delete, Presets panel open. It read 755x627 on its own page; nothing is hard-coded. A fifth row, REFERENCE ARM, fails by name unless that page reads active null, family dither, Customize gone, chip aria-expanded true and one held real size, so a broken reference cannot carry the open row. The shut size row and the picture row are unchanged. The 8-read trail is printed, not graded: 755x449 on the first read, 755x627 from the second on.
  - Clean: exit 0, 5 PASS. After delete held 755x627, after the grab 755x627, reference 755x627. Shut: 755x890 and hash bc1e6df2dd533dc5 on both sides.
  - `DELETE_MUTATE=resize`: exit 1, "FAIL DID NOT RESIZE, shut: after delete 755x890, before delete (undo) 755x808"; PICTURE UNCHANGED fails with it.
  - `DELETE_MUTATE=picture`: exit 1, "FAIL PICTURE UNCHANGED: ... bc1e6df2dd533dc5, before delete (undo) d242301e16a671c3"; the other four PASS.
  - `DELETE_MUTATE=reach`, new: after the delete, a test-only block as tall as Customize was (276 px) goes into the nearest ancestor of Customize still on the page (`div.flex.flex-col.gap-3`), so the panel keeps its height, and comes out before the panel shuts. Exit 1, "FAIL SETTLED TO NO-PRESET SIZE, open: after delete held 755x449, after the grab 755x449, reference 755x627"; the other four PASS.
- **look.** An empty section list used to pass, because the loop ran zero times. Three named FAILs now exit 1: ZERO SYSTEMS, ZERO SHOWN SYSTEMS, SHOWN SYSTEM WITH NO FIELDS. The probe prints how many systems and fields it graded against the Customize section's own field count. Each `LOOK_MUTATE` arm edits the DOM just before the sections are read, so the real read path runs.
  - Clean, fusion/wholeCloth at 1512x982: exit 0, ALL OK, "graded 7 shown system(s) of 7 found, 41 field(s); the Customize section holds 41 field(s)".
  - `LOOK_MUTATE=empty`: exit 1, "FAIL ZERO SYSTEMS", graded 0 of 0.
  - `LOOK_MUTATE=hidden`: exit 1, "FAIL ZERO SHOWN SYSTEMS: 7 section(s) found, every one hidden", plus the existing hidden-with-fields FAIL.
  - `LOOK_MUTATE=nofields`: exit 1, "FAIL SHOWN SYSTEM WITH NO FIELDS: Fusion". The first build of this arm exited 0, and the arm was wrong, not the verdict: stripping `data-field-keys` lets the page's own CSS hide Fusion (6 of 7 shown after), so it built a hidden empty section. The arm now pins the section's display first. The clean run was repeated on the final file: exit 0, 41 of 41.

Limits: the graded-field count is printed against the Customize count, not failed. The reference clears the active preset through the harness, not a click, so it answers what size the page takes with no active preset, not whether the UI gets there.

Not run: tsc (only `.mjs` changed). Dev server on :3139 was this clone's (cwd checked), killed by exact pids 31310, 30871 and 30859; npm exec 30825 exited with them, and :3139 is free. The look probe's three PNGs (tag `hardena3`) were deleted by name; no tracked file under `docs/verification/` changed. `.next/` deleted.
### F118 HARDEN-B6 note, 2026-09-26: key-lanes row 10 now reads the export's pixels, and all 412 frames are byte-identical to live at the same clock. The gate reads 16 of 16 graded, 16 PASS, 0 SELF, exit 0, on hardenB's own server.

1. DONE. The export is lossy WebM. `recordAnimation` (`lib/export/recorder.ts:102`) seeks each plan frame, grabs it with `renderStill` (`components/viewport-3d.tsx:4746`, grid hidden, paper `#fafafa`), paints it on `#fafafa` in an OffscreenCanvas cut to even size (`recorder.ts:207`), and `WebmEncoder.addFrame` hands that canvas to `new VideoFrame` (`lib/export/encoders.ts:178`), then `VideoEncoder.encode` (`encoders.ts:183`, codec from `pickWebmCodec`) and `WebmMuxer`. APNG only when the export is transparent. The frame at `new VideoFrame` is the last lossless copy, so row 10 reads it there and requires byte-identical pixels. No null was measured because nothing lossy sits between that read and live.
2. DONE. Row 10 wraps `window.VideoFrame` and reads every frame the encoder gets, not a sample: 412 of 412 plan frames per run (`rec[0]` is the probe grab `exportAnimation` throws away). Each frame is hashed and compared with a live grab at the same clock: live seeks to the export's `clockMs`, waits two rAFs, and the on-screen GL canvas goes through the same three 2D copies the export makes, at the export's size, 754x358 from a 755x359 GL canvas. Five named frames also print a pixel count: first #0, 25% #99, mid-hold camera move #178 (5933 ms, draw-in held, azimuth still turning), 75% #296, last #411. The bar is 0 differing bytes. Run 1 and run 2 must hash equal frame by frame. The row fails if any frame went unread (read count must equal plan frames) or a named frame is missing.
3. DONE. Both must-fails turn row 10 red and nothing else: 15 of 16 graded pass, exit 1. Sampled state read 0 of 413 differing in both, so the old row would have passed both. That is the Codex defect, shown.
   - (a) `FS_KL_MF_PIX_SHIFT=1` hands the encoder the previous frame's pixels on run 1, a grab one frame late. 394 of 412 frames differ against a bar of 0. Named: 25% 426 px (max channel 169), mid-hold camera move 459 px (max 60), 75% 730 px (max 159), first and last 0. The 18 frames that survive the shift have a pixel-identical neighbour (the held end), where a one-frame lag cannot show (`harden-b6-mf-shift-1-frame.log`).
   - (b) `FS_KL_MF_PIX_BLANK=1` fills run 1's mid-hold frame with solid paper before it is encoded. 1 of 412 frames differs, #178, 647 of 269,932 px, max channel 174 (`harden-b6-mf-blank-frame.log`).
4. DONE. Gate from hardenB's own server: 16 graded, 16 PASS, 0 SELF, exit 0 (`harden-b6-assert-key-lanes.log`, `assert-key-lanes.json` from that run, put back after the must-fails). Row 10's azimuth must-fail now fires on pixels too: 411 of 412 frames. One run takes 2 min 26 s.

**The grid, found by the pixel check.** The first build compared the live canvas as it stands and failed clean: 412 of 412 frames, 10,743 to 14,607 px each, max channel 46 in every frame (`harden-b6-first-run-grid.log`). That is the grid: `renderStill` hides the fsChrome grid, so the export never carries it and live always does. The fix masks no pixels. It skips the grid's draw on the live side and proves that is all it skipped: WebGL2 LINES draws are counted since each clear, every export grab must have made 0, and every live grab exactly 1, skipped. A second line object anywhere in the scene fails the row. Across both runs, 824 export grabs read 0 and 824 live grabs read 1 skipped.

**Not checked.** The encoded WebM is never decoded, so a fault in `VideoEncoder`, the muxer or the download (a corrupt chunk, a dropped frame in the file, a wrong timestamp) still passes row 10; the row text says so. Closing it needs no decoder built: load the downloaded blob into a `<video>` in the same page, seek to each named frame, grab it with `requestVideoFrameCallback`, and measure the null first (the same frame from the two identical exports, and neighbouring held frames) before setting a bar. Must-fail (a) moves pixels at the encoder input, not the app's seek, which the gate cannot reach. Whether this scene's contact shadow is on was not checked; both sides render the same shadow either way.

Branch `lane/hardenB` in `~/.fs-lanes/hardenB`, on main `95f724f87`. One dev server on :3138, `next dev` pid 74344, listener 74347 and its postcss worker 77932, each cwd checked with `lsof`, killed by exact pid; :3138 is free. One headless browser per run. tsc not run: only `.mjs` and docs changed. `.next/` deleted.

### F118 HARDEN-B5 note, 2026-09-26: base provenance DONE for key-lanes row 11, and row 10's `close` refuses what it used to wave through. The gate reads 16 of 16 graded, 0 SELF, exit 0, on hardenB's own server.

1. DONE. Row 11 takes its base from `serverCommit(3138)` under the B3/B4 rules. `nokeys-base.json` recorded from a clean sparse worktree of `ea31c5b38`, removed and confirmed gone. The unlabelled, no-label, other-label and wrong-label refusals fired, each exit 2 with nothing written.
2. DONE. `close` is true only when both sides are finite. Absent camera data fails row 10 by name. Must-fails shown: the one-liner, and a gate run with one camera sample forced to undefined reads row 10 red, exit 1.
3. DONE. Gate run from hardenB's own server: 16 graded, 16 PASS, 0 SELF, exit 0.

Branch `lane/hardenB` in `~/.fs-lanes/hardenB`, rebased on main `95f724f87` (LOG.md and RUN-QUEUE.md conflicts were both-new entries; both kept). One dev server at a time on :3138: base `ea31c5b38` pid 57194 under `next dev` 57189, then hardenB pid 58037 under 58031. Each cwd checked with `lsof` before the kill, killed by exact pid. One headless browser per run. tsc not run: only `.mjs` and docs changed. `lib/server-commit.mjs` untouched. `.next/` deleted.

**Row 11, as `assert-resize-settles` applies the rules.** The record form is now `--nokeys-only --base=ea31c5b38`; `--label` is gone and the file is always `nokeys-base.json`. Record exits 2 on no `--base`, on any label but `ea31c5b38`, on `srv.dirty`, and on `srv.head` differing from `git -C srv.top rev-parse --verify <label>^{commit}`. It reads `serverCommit` again after the grab and writes nothing on any change of pid, head or dirty. The file stores `{ base, sha, recordedFrom, at }` beside the window, canvas and frames. Compare exits 2 on a missing base file or one without a 40-hex `sha`, before it reads the server. Row 11 is SELF when `base.sha === srv.head || !codeDiffers(srv, base.sha)`; a `codeDiffers` throw exits 2. A SELF row prints SELF, never PASS. The row count now reads `graded + SELF === 16`, and a SELF row does not by itself fail the run. All checks run before the browser launches. The window and canvas checks on row 11 are unchanged.

**The base.** `ea31c5b38` has every hook the no-keys pass calls (`injectStrokes`, `setEase`, `setPlaying`, `setProgress`, `__captureHarness.grab`) and no dock: its canvas came up 755x890 at 1512x982 with no stylesheet. Recorded `sha ea31c5b38b6afb95151972f60795b40d1ccf0ac1`, `recordedFrom /Users/sebs/.fs-lanes/base-ea31c5b3`. All five frame hashes equal the old unlabelled file (`cafacbc8`, `74f9e77f`, `89ed3152`, `2e863e3b`, `75e9e87e`), so the ANIM-3G file was right; now it can prove it (`harden-b5-record-base-ea31c5b38.log`).

Refusals, each exit 2, nothing written:
- Compare on the old unlabelled `nokeys-base.json`, no server up: `has no stored sha (got undefined)` (`harden-b5-refuse-unlabelled-base.log`).
- `--nokeys-only` with no label: `needs --base=ea31c5b38` (`harden-b5-refuse-no-label.log`).
- `--nokeys-only --base=347e22e6b`: `row 11's base is ea31c5b38` (`harden-b5-refuse-other-label.log`).
- `--nokeys-only --base=ea31c5b38` on hardenB's own server: `is ea31c5b38b6a..., but the server on :3138 (/Users/sebs/.fs-lanes/hardenB) runs c2f93f000...` (`harden-b5-refuse-wrong-label.log`). The base file stayed byte-identical.

**Row 10.** The old helper, `a === b || |a - b| <= 1e-6 || both NaN`, read `close(NaN, NaN)`, `close(undefined, undefined)` and `close(null, null)` as true; the new one reads all three false and still reads 1 against 1.0000001 as true (`harden-b5-close-must-fail.log`). A mismatch now names its side: `camera.azimuth(export NaN)`. The old loop compared only the keys the export's sample carried, so an empty sample compared nothing; now every keyed property (drawProgress, azimuth, turn, depth) is compared, and an unkeyed one must be undefined on both sides or the frame fails. `if (r.camera && ...)` skipped a frame with no camera reading; now `camera(absent: export)` or `camera(absent: live)` fails it.

Must-fail run (`harden-b5-mf-camera-undefined.log`), with `FS_KL_MF_CAMERA=1`, which drops run 1's middle frame's camera: `FAIL 10 ... run 1: 1/413 frames differ ... 6833ms:camera(absent: export)`, 15 of 16 graded pass, exit 1.

**The run** (`harden-b5-assert-key-lanes.log`, `assert-key-lanes.json` from this run): 16 of 16 graded rows PASS, 0 SELF, exit 0; main read 16 of 16 before this lane. Row 11 is a real comparison: hardenB's code differs from `ea31c5b38`, and 5 of 5 frames equal the base; its must-fail read 0 of 5. Row 10 passes under the stricter helper: 0 of 413 frames differ on both runs, so depth, yaw and all three camera values were finite on every frame, export and live.

**Not checked.** The SELF path on row 11 never ran: hardenB's code differs from the base, so `codeDiffers` read true. No positive control is possible against `ea31c5b38` itself, because the compare form waits for `__fsTake` and `__fsSetKeys`, which that commit does not have. Row 10's exported pixels are the next lane's.

### F118 HARDEN-B4 note, 2026-09-26: base provenance DONE for the resize and perform gates. Resize reads 5 of 5 graded, 0 SELF. Perform reads 14 PASS, 0 FAIL, 1 SELF: row 8, which is right on a lane that changes only scripts.

1. DONE. `assert-resize-settles --record` takes the commit from `serverCommit(3138)`, refuses a dirty server, a HEAD that is not the label, and any label but `a8c03f2c8`, and rereads the server before it writes. Compare refuses a missing or unlabelled base before it reads the server; row 4 reads SELF against the served code. Base `a8c03f2c8` recorded from a clean sparse worktree, removed and confirmed gone. The wrong-label and unlabelled-base refusals fired.
2. DONE. `assert-perform --phase=base` takes the commit from the server, not its own repo, under the same rules, and needs `--base=<sha>`. `base-main.json` recorded from a clean sparse worktree of main `0fcee4b7e`, removed and confirmed gone. The base phase now grabs undocked, like row 8; see below.
3. DONE. Both gates run from hardenB's own server. Counts and SELF rows below.

Branch `lane/hardenB` in `~/.fs-lanes/hardenB`, rebased on main `0fcee4b7e`. One dev server at a time on :3138 (base `a8c03f2c8` pid 37679, main `0fcee4b7e` pid 41357, hardenB pid 46154), each cwd checked with `lsof` and killed by exact pid with its `next dev` parent; one headless browser per run; `.next/` deleted. tsc not run: this lane changes only `.mjs` files and docs. `lib/server-commit.mjs` needed no change.

**The rules, as `assert-custom-presets` applies them.** Both gates import `serverCommit` and `codeDiffers` from `lib/server-commit.mjs` and call `serverCommit(Number(new URL(LAB_URL).port))` before the browser launches; a throw exits 2 with its message. Record exits 2 on `srv.dirty` or on `srv.head` differing from `git -C srv.top rev-parse --verify <label>^{commit}`, reads `serverCommit` again after the run, writes nothing on any change of pid, head or dirty, and stores `{ base, sha, recordedFrom, at }`. Compare exits 2 on a base file that is missing or has no 40-hex `sha`, before it reads the server, then marks SELF when `base.sha === srv.head || !codeDiffers(srv, base.sha)`, and a `codeDiffers` throw exits 2. A SELF row prints SELF, never PASS, sits outside the pass count, is named in the summary, and does not by itself fail the run. The resize gate checks its own row total, so SELF rows count toward it: `graded + SELF === 5`.

**Resize.** `a8c03f2c8` is the parent of the fix `f494b6349`, the commit that recorded main's frames before F122-B, as the header says. The recorded hashes are untouched `b7e4895e4b6a3351`, dither `4b39dd5edb6b6d6a`, ascii `db64ef885f4042c7`, all three equal to the old unlabelled file. Refusals, each exit 2 and nothing written:
- Compare on the old unlabelled `main-hashes.json`, no server up: `has no stored sha (got undefined)` (`harden-b4-refuse-unlabelled-base.log`).
- `--record --base=0fcee4b7e` on the `a8c03f2c8` server: `row 4's base is a8c03f2c8` (`harden-b4-refuse-other-label.log`).
- `--record --base=a8c03f2c8` on hardenB's own server: `is a8c03f2c8a6bc..., but the server on :3138 (/Users/sebs/.fs-lanes/hardenB) runs d70ed220b...` (`harden-b4-refuse-wrong-label.log`).

Positive control for SELF (`harden-b4-self-control-on-a8c03f2c8.log`): compare mode against the `a8c03f2c8` server itself read row 4 and its must-fail as SELF on both arms, and rows 1, 2, 3 and 5 red on both arms, which is main before the fix. `0/4 rows graded; 1 SELF`, exit 1. That run rewrote four evidence PNGs with pre-fix frames; hardenB's run below wrote them back byte-identical to the committed ones.

The run (`harden-b4-assert-resize-settles.log`): 5 of 5 rows GRADED, 0 SELF, exit 0. 13 arm lines, 9 PASS and 4 FAIL. The 4 FAIL lines are all must-fail arms and the gate classifies them as such: rows 1, 2 and 3 on `__fsViewportSync = "off"` (12086, 15520 and 1770 px differ) and row 5 on `__fsStrokeFrame = "live"` (2745 px, world width 3.5004 to 3.8354). Row 4 is a real comparison, not SELF: hardenB carries the fix, so its code differs from `a8c03f2c8`, and 3 of 3 frames match on both arms; its must-fail moved the hash to `daf9565db34b5b2c`.

**Perform.** `base-main.json` said `633f110f9` with no provenance. Recorded again from main `0fcee4b7e`. The first record grabbed on the docked page, as the base phase always had, and every rod frame moved (`harden-b4-record-base-0fcee4b7e-docked-discarded.log`; that file was overwritten). Row 8 grabs on a page with the dock floated, canvas 755x890 from mount, and `633f110f9` had no dock, so base and row agreed only while main had none. The base phase now opens the page undocked through `lib/undock.mjs`, which throws on a dockless main, and stores `undocked: true`. Recorded that way, the take, the slots, all three clocks and all 18 frame hashes equal the old `633f110f9` file; only the provenance fields and `performButton`, now true, differ.

Refusals, each exit 2 and nothing written:
- Lane run on the old unlabelled `base-main.json`, no server up: `has no stored sha (got undefined)` (`harden-b4-refuse-unlabelled-base.log`).
- `--phase=base` with no label: `needs --base=<the main sha the server runs>` (`harden-b4-refuse-no-label.log`).
- `--phase=base --base=0fcee4b7e` on hardenB's own server: `is 0fcee4b7ed70..., but the server on :3138 (/Users/sebs/.fs-lanes/hardenB) runs d70ed220b...` (`harden-b4-refuse-wrong-label.log`).

The run (`harden-b4-assert-perform.log`): 14 PASS, 0 FAIL, 1 SELF, exit 0. HARDEN-B2 read 15 of 15. One row moved, row 8, from PASS to SELF, and the base change is why: its base is now main `0fcee4b7e`, whose app code this lane does not touch, so `codeDiffers` reads false and the row compares the tree to itself. SELF, by name: `8 no performance: take, slots and 18 frames equal main's (0fcee4b7e), before and after an Esc`. Its numbers still read: rod 9/9, inflate 9/9, equal after Esc, all three 1 ms bumps unequal, performed frames unequal. The other 14 rows pass, as at HARDEN-B2; row 1b's left-out shares are 2.7%, 1.5% and 2.9% against the 5% cap. Not checked: row 8's graded path against the new base, because no tree here changes product code. The run rewrote four `f121-dwell-*` files in the perform folder; they are F121's evidence, so I checked them back out.

**For the controller: row 8 cannot grade against this base on a lane that changes product code.** Its predicate still requires `base.performButton === false`, from when main had no Perform stage. Main `0fcee4b7e` has the button, so on the first lane where row 8 is not SELF it fails on that clause alone, whatever the frames say. SELF by code difference now covers what the clause was for ("or row 8 compares the lane to itself"). I did not remove it, since that would loosen a bar; it is your call. Also outside my paths: the F121 evidence record at `assert-perform.mjs` line 472 still stamps `head` from the gate's own repo.

### F118 LANES-UI-2 note, 2026-09-26: NOT MERGE-READY. Steps 1 and 2 are built and compile; step 3 ran once and found the lanes opening moves the view, not the width; steps 4 to 6 were not started. The lane hit its context line.

**What blocks it:** no gate row is written, no screenshot was taken, no regression ran. Nobody has looked at the clamp note or the Camera picker on a page.

**Done on `lane/lanesui`, tsc 6 errors, the baseline, none in these files:**
- `9de997c3e` step 1, the clamp note. A muted line under the Width row, shown when the engine draws short of the keyed width. Solid reads "Solid draws this at 1.56x. Any wider and the counters close." (or "It won't go thinner."), Extrude "Extrude draws this at Nx, the end of its width slider.", and the full `widthClamp` sits in the title. A rAF reads `liveRef` only while the lanes are open and the width track has keys, and sets state only on change. The note holds once seen, since a line that came and went every loop would move the dock under the pointer; it clears on a track or engine change, or when the engine draws past the recorded limit unclamped. `KeyLiveValues` gains `widthReached`; the viewport writes it (Rod writes its own width, since it never clamps).
- `63e1853e2` step 2, the Camera picker. A "Camera" button at the right end of the Keyframes row opens a list above it (the existing Radix popover, `side="top"`). Each of the 4 moves shows its name, its tracks and its reason, timed through `tryCameraMove` to `ctx.slotsRef.current` with `takeMs` = the last slot end, `penMs` if none. A refused move stays listed, disabled, reading "Can't run here:" and why. No slots at all refuses every move by name instead of timing to nothing. Picking clears only `move.tracks` and writes the move's keys in one `setKeys`, so one undo; a move that would replace keys says "Replaces the N keys on Orbit." Keys typed in the list no longer bubble to the lanes' Delete and Escape.

**Step 3, one run on :3138, headless, 1512x982, Rod then Solid, playheads 0.1, 0.4, 0.7, 1:**
- A width-only track at 1 against no keys: drawn counts equal at 8 of 8, applied depth and yaw equal, camera azimuth and elevation equal. The GL frame differs at 8 of 8 and the camera's distance reads 1.4322 against 1.7000 (Rod).
- The cause is layout, not the width path: setting ANY keys opens the lanes, the dock grows 84 px (7 rows of 12), the canvas goes from 755x533 to 755x449, and the fit changes. An azimuth-only track at 45 gives the same 1.4322. Repeated none, w1, none, w1, none, az45, none: every "none" is frame `ed5f2d10` at 1.7000, so it is reproducible and returns clean.
- Not run: the like-for-like check, width at 1 against no keys with the lanes open in both (or undocked through `lib/undock.mjs`, as row 11 does). That is the check the brief asked for, and it is still open.
- A width key at 2 does widen: Solid's drawn count moved (5940 to 8100 at 0.1) and the frame differed at 8 of 8. The note line was not read in that run.

**Not done, in order, for the next lane:**
1. Step 3 like-for-like: lanes open in both states, frames at the same canvas.
2. The five gate rows in `assert-key-lanes.mjs`, each with its must-fail. `__styleHarness.setMode("solid")` switches the engine; `[data-width-clamp]`, `[data-camera-picker]`, `[data-camera-move=id]`, `[data-refused]` and `[data-camera-reason]` are the hooks. Row 11's base comparison must keep its window and canvas. The footer's `rows.length === 11` check has to move to the new count.
3. The 1512x982 screenshot with the Width row and the picker open, looked at, and fixed where it reads wrong.
4. The five regressions and `assert-width-keys` 12/12.

**His localhost steps:** none yet. Nothing here has been seen on a page by a person.

**Not checked:** the gate, the screenshot, every regression. The dev server on :3138 was killed by pid after its cwd read this clone; `.next/` is deleted. `LOG.md` was not touched, since it is outside this lane's paths; this note is the handoff.


### F118 LANES-UI-3 note, 2026-09-26: NOT MERGE-READY. The gate reads 15 of 16, and the one failure is the gate's own guard, not the product. The screenshot and the five regressions were not run; the lane hit its context line.

**What blocks it:** row 12 fails on a guard I wrote too tight (below), the 1512x982 screenshot was never taken or looked at, and no regression ran on this rebase. Nobody has seen the clamp note or the Camera picker on a page.

**The width-1 answer (step 1): byte-identical.** Width keys at 1 and nothing else, against no keys, with the lanes open in both states: Rod 4 of 4 frames equal at canvas 755x449, Solid 4 of 4 at 755x409, playheads 10, 40, 70 and 100%. Undocked through `lib/undock.mjs` in row 11's page: 5 of 5 equal at 755x890. The 1.70 against 1.43 camera distance LANES-UI-2 saw was the lanes opening, as it guessed.

**Done on `lane/lanesui`, rebased on main clean (5 of 5 commits), `ed8ec67f4`:** rows 12 to 16 in `scripts/verify/assert-key-lanes.mjs`, each with a must-fail that fired. The footer now wants 16 rows. `components/key-lanes.tsx` is unchanged this lane, so tsc was not rerun; LANES-UI-2 left it at the 6-error baseline.
- 12 FAIL, width 2 widens and 1 is identical. Ink counted against each engine's empty plate (the no-keys frame at 0): Rod 148, 618, 1091, 1556 px at width 1 against 275, 1096, 1921, 2748 at width 2; Solid 589, 2230, 4004, 5590 against 18278, 20520, 22744, 24626. Must-fail: width 2 is 0 of 4 frames equal, width 1 does not widen. **It fails on `W[m].plateDrawn === 0`: Rod draws 96 of 72,960 at playhead 0**, one dot where the pen starts. The fix is one line, loosen the guard to under 1% of the total, then rerun. Not made, since it would ship unrun.
- 13 PASS, Solid at 2 reads "Solid draws this at 1.95x. Any wider and the counters close." and shows whole. Must-fail: Rod at 2 and Solid at 1 show no note.
- 14 PASS, Settle to front changes only azimuth and elevation (turn and width untouched), 20 to 0 and 30 to 0 from 12,324 to 13,116 ms. The camera reads 20.00 at the start, 18.43 at 12,460, 0.00 at 13,116, where the drawn count reaches 72,960 of 72,960; 28,869 px move. Must-fail: the undone take reads 0.00 throughout.
- 15 PASS, Turn in the lifts is disabled and reads "Can't run here: the pen never lifts for 120 ms or more in this take..." and a real click writes nothing. 2 of 4 moves listed as refused, each with that prefix. Must-fail: Settle to front is not refused and its click writes keys.
- 16 PASS, one undo after the pick returns the take to turn and width, equal to before. Must-fail: the state before the undo differs.
- Rows 1 to 11 pass on this rebase.

**Worth a look, not changed:** with no keys the camera reads 0, 0 (face-on). Settle to front starts from the move's own desk pose, 20 and 30, so picking it holds the whole take at that angle and only the last 0.8 s settles. That is the move as `lib/camera-moves.ts` writes it; passing the live pose as `from` would make it start where his camera is, and refuse when that is already face-on. His call.

**Not done, in order, for the next lane:**
1. Loosen row 12's plate guard, rerun `assert-key-lanes`, want 16/16.
2. Run `docs/verification/keyframes/shot-lanes-ui-3.mjs` (written, never run). It refuses to write a shot without the note and all 4 moves. Open both PNGs, write what shows, fix what reads wrong in `key-lanes.tsx`.
3. Regressions: `assert-stroke-strip` 18/18, `assert-take-timeline` 21/21, `assert-stroke-timing-browser --grade-solid` 38/38, `node scripts/verify/assert-width-keys.mjs` 12/12, and tsc at 6.

**His localhost steps, once it passes:** open the lab, pick Solid, press + on Width twice and set the second key to 2. The line under Width should read "Solid draws this at 1.95x." Then Camera, Settle to front, play to the end, and ⌘Z once.

**Not checked:** the screenshot, every regression, tsc on this rebase. The dev server on :3138 was killed by pid after its cwd read this clone; `.next/` is deleted. `LOG.md` was not touched, since it is outside this lane's paths; this note is the handoff.

### F118 LANES-UI note, 2026-09-26: NOT MERGE-READY. The Width lane and the viewport's width are in and compile; nothing has run in a browser, the Camera picker is not built, and no gate row is written. The lane hit its context line.

**What blocks it:** no browser check of any kind. Nothing proves a width key widens the mark on screen, or that a take with no width keys still draws byte-identical. Steps 2 to 5 of the brief were not started.

**Done on `lane/lanesui` (3a720bd2c), tsc 6 errors, the baseline, none in these files:**
- `lib/keyframes.ts`: `"width"` folded into `KeyProperty`, `KeyableProperty` deleted (6 uses renamed, no other file used it).
- `components/stroke-strip.tsx`: `KeyLiveValues` gains `width` and `widthClamp`.
- `components/key-lanes.tsx`: one `LANES` row, Width, `x`, 2 digits, after Distance. "+" reads `live.width`.
- `components/viewport-3d.tsx`:
  - `KeyReader` carries its `keys` (one field), so the width reads go through `widthForFrame` on the same keys the reader samples.
  - Rod, in `AnimatedStrokesInner`: a `useFrame` that runs `widenAlongNormals(base, normal, rodNormalOffset(w), positions)` from a copy of each tube's positions as built, and scales caps and joint spheres by `w`. The applied width is kept per position buffer, so a rebuilt tube picks up the current width. No width keys and nothing widened: one check and out. Back at 1 it copies the built positions back and sets scale 1.
  - Inflate, Extrude and Solid, in `Scene`: a `useFrame` puts `widthForFrame(mode, keys, clockMs)` in state only when it changes; `previewParamsAtWidth` feeds `useStrokeMeshes`. With no width keys it hands back the same params objects, so the meshes memo's signature is the shipped one. If `previewParamsAtWidth` throws (Extrude or Solid with no params), the mark draws at the shipped width and the reason goes to `widthClamp` instead of blanking the page.
  - `KeyLive`'s first write has `width: 1, widthClamp: null`; `Scene`'s loop writes `width` (`widthAt ?? 1`) and the clamp each frame.

**Not done, in order, for the next lane:**
1. The clamp note on the Width lane: poll `liveRef.current.widthClamp` with a rAF while the lanes are open and the width track has keys, setState only on change, show it as a small muted line on the Width row.
2. The Camera picker in the lanes header. Slots: read `ctx.slotsRef.current`, which the strip writes every render; on an untouched take those are the pace's base slots, which is what one neutral row gives. `takeMs` is the max slot end, falling back to `ctx.penMs`, the same rule `buildTimedSchedule` uses (`lib/stroke-timing.ts:416`). Call `tryCameraMove(move, { slots, takeMs, keys })`; on keys, write `setKeys({ ...keys, ...moveKeys }, null)` after deleting only `move.tracks`, one call so one undo step. A refusal stays listed, greyed, reason shown.
3. The four gate rows in `assert-key-lanes.mjs`, each with its must-fail, then the 1512x982 screenshot, then the five regressions.
4. `viewport-3d.tsx` line with `hasAnyKey`: a width-only track makes a `KeyReader`; check in the browser that it changes nothing else (the W note flagged it).

**His localhost steps:** none yet. Nothing here has been seen on a page.

**Not checked:** no dev server, no browser, no gate, no regression ran on this lane. `LOG.md` was not touched, since it is outside this lane's paths; this note is the handoff.

### F118 ANIM-3C-W note, 2026-09-26: NOT MERGE-READY. Step 1 is done and gated, step 2's mapping is written, and the gate and the cost numbers are not. The lane hit its context line before `assert-width-keys.mjs` or any bench ran.

**What blocks it:** `scripts/verify/assert-width-keys.mjs` does not exist, so nothing proves width 1 is byte-identical to shipped on any engine, and no rebuild cost was measured. `WIDTH_REBUILD_STEP_MS` (1000/30, DESIGN.md's "at twos") is a placeholder with no numbers behind it yet.

**Done on `lane/width`:**
- `lib/keyframes.ts` (6297da687): `width` is a track, a multiplier on the shipped stroke width, `WIDTH_MIN = 0.5` to `WIDTH_MAX = 2`. `validateTrack` refuses a value outside that with `width 2.5 is outside 0.5..2, a multiplier on the shipped stroke width`. `KEY_PROPERTIES`, `TakeKeys`, `KeySample`, the validators and samplers carry width, so `lib/doc-store.ts` now keeps a width track instead of dropping it.
- The exported `KeyProperty` stays the six. `components/key-lanes.tsx:439` indexes `KeyLiveValues` (`components/stroke-strip.tsx:105`) by it, and that interface has no `width`, so widening it was tsc error 7 in a file this lane may not touch. The full list is `KeyableProperty`. The UI lane folds it back (below).
- `assert-keyframes.mjs`: 16 of 16 rows, 21 of 21 mutants caught (was 18). INVALID-PROP became WIDTH: 0.5 and 2 accepted and sampled (1.25 at the midpoint), 2.5, 0.25 and 0 refused by the validator and both samplers, and `thickness` still refused as not keyable. New mutants: width range check dropped, width not in `KEY_PROPERTIES`, `WIDTH_MAX = 1`. EMPTY now expects 7 properties and SAME-CLOCK keys width too; no row was loosened.
- `lib/width-keys.ts` (86aed98ca), no engine edit:
  - Rod, per frame: `widenAlongNormals(base, normal, rodNormalOffset(w), out)`. A Rod tube is a `THREE.TubeGeometry`, every vertex `centre + TUBE_RADIUS * normal`, so the offset is the tube at radius `w * r`. Caps and joints scale by `w`. Offset 0 copies bits (adding 0 turns -0 into +0). The cap inset stays 0.35 r, where a rebuild would move it to 0.35 w r.
  - Inflate, rebuild: `nibWeight * w`. The nib map already scales the field radius on both axes and leaves Z alone. There is no ceiling.
  - Extrude, rebuild: `width * w` inside the slider's own `EXTRUDE_WIDTH_MIN..MAX`, and `depth / reached`. Extrude's depth is a multiple of its width, so without the division a width key would deepen the mark too.
  - Solid, rebuild: the slider value whose calibrated px is `w` times today's, found by bisection on `computeSolidEffectiveThicknessPx` itself. Measured in Node: the default 38 is 22.580 px, w 1.5 lands at 1.500000000x (slider 52.33), and w 2 stops at 44 px, 1.949x, returned with the reason as `clamp`, never drawn short without saying so.
  - `w === 1` and no keys return the caller's own params object (checked: `=== DEFAULT_SOLID_PARAMS`).
  - Throttle: `widthForFrame(mode, keys, clockMs)` samples Rod every frame and the three rebuilders at `widthBuildClockMs`, the last step boundary or the last key at or before the clock, whichever is later. The snap to key times is why it cannot skip the final value. The rule: rebuild only when that width differs from the last one built. No epsilon: an epsilon can strand the mark within epsilon of the last key forever.
- tsc 6 errors before and after, the same six; `--listFilesOnly` confirms tsc compiles `lib/width-keys.ts`. No browser opened, no dev server.

**Next lane, in order:**
1. `assert-width-keys.mjs`. Rows, each with a must-fail through `GATE_MUTATE_FILE`: width 1 equals shipped on each engine, 120 hero frames per engine with the bench's frame set and signature; first check that the gate's own shipped signatures equal `solid-bench/bench.mjs --sigs=` 120 of 120, which proves the gate sees what the rig sees. Width 2 widens a horizontal straight line's Y extent by `reached` on each engine, Z held on Extrude, Solid and Inflate, and Z times w on Rod. A width key between two times interpolates through `widthForFrame`. The throttle builds the last key's value at the last key's time and after it. Out-of-range keys refused.
2. Bench each rebuild (Solid static and animated, Extrude, Inflate hero) and Rod's `widenAlongNormals` pass on the hero, then set `WIDTH_REBUILD_STEP_MS` from those numbers.

**How the UI lane adds the Width lane in `components/key-lanes.tsx`:** add `width: number` to `KeyLiveValues`, written each frame as `widthAt(keys, clockMs) ?? 1`. Then fold `"width"` into `KeyProperty` in `lib/keyframes.ts` and delete `KeyableProperty`. Add one `LANES` row, `{ prop: "width", label: "Width", unit: "x", scale: 1, digits: 2 }`. In the viewport, Rod calls `widenAlongNormals` on the tube from a kept copy of its positions and scales cap and joint spheres by `w`. The other three pass `previewParamsAtWidth(mode, params, widthForFrame(mode, keys, clockMs)).params` into `buildPreview`, show `clamp` when it is not null, and rebuild only when the width changes. `viewport-3d.tsx:7616` treats a width-only track as "has keys"; check that it changes nothing else.

### F118 ANIM-3C-W2 note, 2026-09-26: NOT MERGE-READY. The gate is written and green; `WIDTH_REBUILD_STEP_MS` is not set, because the bench says one constant cannot serve Inflate and the other two rebuilders at once. The lane stopped at its context line before choosing.

**What blocks it:** `WIDTH_REBUILD_STEP_MS` is still the 1000/30 placeholder, and Inflate's hero rebuild is 88 to 107 ms mean and 174 to 217 ms p95. At 33 ms steps Inflate asks for a new build three to six times faster than one can land. `assert-keyframes.mjs` was not rerun on this lane; nothing under `lib/` changed here (9c1b39be9 touches `scripts/verify/` only).

**Done (9c1b39be9):**
- `scripts/verify/assert-width-keys.mjs`: 12 of 12 rows, 9 of 9 mutants caught, no row without a must-fail, 2 min 50 s. Rows: SIGS; IDENTITY for Rod, Inflate, Extrude and Solid (a width track held at 1, 120 hero frames each, 120 of 120 byte-identical on all four); WIDEN for each engine on a horizontal line (Rod Y and Z 2.0000x, Extrude Y 2.0000x Z 1.0000x, Inflate Y 1.9961x Z 0.9981x, Solid 1.459x at w 1.5 and 1.918x at w 2 with the clamp reason printed); INTERP (1 to 2 over 1000 ms, 1.5000 at the midpoint on Rod, drawn width follows); THROTTLE (a take ending on a key at 1010 ms, off a step boundary, at 60 Hz and on a janky clock: every key's value at its time, the final 2 built at the end, 33 rebuilds over 62 frames against a cap of 34); RANGE (2.5, 0.25 and 0 refused 16 of 16 per value with the reason, 0.5 and 2 accepted).
- The instrument first: SIGS runs `solid-bench/bench.mjs --input=hero --sigs=` as a child with `GATE_MUTATE_FILE` removed and requires the gate's own shipped Solid signatures to match, 120 of 120. Its must-fail moves `DEFAULT_SOLID_PARAMS.thickness` by 0.5 in the gate only, and SIGS goes red alone.
- Mutants, each turning exactly its named rows red: gate and rig on different Solid builds (SIGS); a held 1 sampled as 1.01 (all four IDENTITY rows); no engine follows width (all four WIDEN rows and INTERP); Extrude's depth grows with width (WIDEN-EXTRUDE); Solid clamps and says nothing (WIDEN-SOLID); width reads the first key (INTERP); the throttle does not snap to key times (THROTTLE); the rebuilders rebuild every frame (THROTTLE); width out of range accepted in `lib/keyframes.ts` (RANGE).
- `solid-bench/bench.mjs` gains `--engine=` and `--width=`. The hero, the frame set and the signature moved to `solid-bench/hero-sig.mjs`, one copy for bench and gate; bench is identical to HEAD on hero, `--static`, `--input=o` and `--input=shapes` (120, 120, 120 and 5 of 5), selftest 5 of 5.
- Finding, Solid: its drawn width does not scale exactly with `computeSolidEffectiveThicknessPx`. The mapping lands the calibrated px exactly; the raster mark comes out 2.7 % narrow at w 1.5 on the animated path (2.1 % static), 1.6 % narrow at the clamp, and 0.5 % wide at w 1.45. WIDEN-SOLID allows 4 % and says why.
- Finding: `previewParamsAtWidth` and `rodNormalOffset` do not range-check; only `widthAt` does. Every key enters through `widthAt`, so RANGE holds, but a direct caller passing 2.5 gets Inflate at 2.5x with no complaint.

**Bench, hero, 120 reveal frames, mean / p95 ms.** Load average was 10 on 16 cores, so every absolute number reads high; rerun idle before quoting it.

| engine | w 1 | w 1.25 | w 1.5 | w 2 |
|---|---|---|---|---|
| Rod `widenAlongNormals` pass | 0.00 / 0.01 | 0.01 / 0.02 | 0.01 / 0.02 | 0.01 / 0.02 |
| Extrude rebuild | 0.79 / 1.60 | 0.77 / 1.48 | 0.74 / 1.43 | 0.76 / 1.56 |
| Solid rebuild, animated | 3.67 / 7.53 | 3.56 / 6.61 | 3.72 / 7.67 | 3.20 / 5.48 (clamps at 1.949x) |
| Solid rebuild, static | 5.91 / 11.67 | 5.94 / 11.23 | 5.78 / 11.22 | 6.02 / 11.43 |
| Inflate rebuild | 106.66 / 216.83 | 97.91 / 189.76 | 95.35 / 186.41 | 87.75 / 173.91 |

**The step, reasoned, for the next lane to apply.** A 60 fps frame is 16.7 ms. Rod's pass is 0.02 ms p95, so it stays per frame. Extrude at 1.6 ms p95 and Solid at 7.7 ms p95 (11.7 static) fit inside one frame synchronously, so 1000/30 holds for them. Inflate fits in no frame at 217 ms p95, and no step fixes that on the main thread. It does not have to: the viewport already defers Inflate builds to a worker (`lib/implicit-defer.ts`), so the page keeps 60 fps and the step only has to be no shorter than one worker build, or builds queue and the mark trails the clock. Recommendation: a per-engine step, 1000/30 for Solid and Extrude and 250 ms for Inflate, above the 217 ms p95 measured under load. One constant sized for Inflate would step Solid and Extrude at 4 Hz for nothing. `widthBuildClockMs` already takes `stepMs`; `widthForFrame` has to pass the mode's. Then rerun `assert-width-keys.mjs` (THROTTLE reads the step) and `assert-keyframes.mjs`, and price the worker build in the browser, where the implicit-defer header measured about 2x Node.

### F118 ANIM-5A note, 2026-09-26: MERGE-READY for the Node model. No UI was built and nothing on `/` offers these moves yet. `assert-camera-moves.mjs` is 10 of 10 rows, 16 of 16 must-fails caught; tsc is 6 errors, the baseline, none in the new file.

**What was built.** `lib/camera-moves.ts` and `scripts/verify/assert-camera-moves.mjs`, on `lane/camera` (commits `f88a60062`, `b873590a9`). A camera move is a function that returns ordinary keys on the `azimuth`, `elevation` and `distance` tracks of `lib/keyframes.ts`, which `KeyCamera` already samples. There is no second camera. Every key is Easy Ease, never `hold` or `linear`, so editing a value later eases instead of snapping. Every key lands on a moment in the timed schedule, mapped through the drawProgress remap (`revealClockMs`), so a pause in the drawing moves the camera's keys with it.

| move | reason line he reads | tracks | lands on |
|---|---|---|---|
| Turn in the lifts | Turns only while the pen is up and holds dead still while each stroke draws, so the depth shows and the line never slides. | azimuth | both edges of every pen lift of 120 ms or more; 30 deg total, split by lift length so every lift turns at the same peak speed |
| Settle to front | Starts at the desk angle and eases square to the page as the last stroke lands, so the finished word ends facing you. | azimuth, elevation | the last stroke's landing; starts on the latest stroke start that leaves 700 ms |
| Depth turn | Holds on the finished word, turns it to show its depth, holds, then turns back, so it ends the way it was drawn. | azimuth | the landing, then 400 ms still, 1000 ms out to 40 deg, 600 ms still, 1000 ms back |
| Lean in on the pause | Comes closer and looks down a little while the drawing pauses, so the pause reads as a closer look. The tilt keeps it from reading as a zoom. | distance, elevation | the longest drawProgress pause (two keys at one value, or a hold), 200 ms or more; distance x0.8, elevation +8 |

The start poses are the options board's two framings: C-B desk (az 20, el 30) and C-A front (0, 0). The board's reasons shaped two moves: Lean in pairs the push with a tilt because a bare push on a lone object reads as a zoom, and Depth turn waits 400 ms on the landing because the board's cuts land on stillness.

`thinKeys(samples, tolerance)` is Apple Motion's "Peaks Only": keys at rest on each turning point that reverses by more than the tolerance, then a key at the worst sample of any span that misses, with a handle that carries the speed through. On a 6 s recorded path of 360 samples it gives 31, 25, 19 and 17 keys at 0.25, 0.5, 1 and 2 deg, each within its tolerance. A held stretch comes out as a flat span.

**Found, and it matters for the UI lane.** The shipped take has no pen lifts. `strokeArcSpans` is contiguous arc length, so every slot ends where the next starts (probed: 3 strokes, slots 0-600, 600-1400, 1400-2000). Turn in the lifts refuses on an untouched take with "the pen never lifts for 120 ms or more in this take ... Open a gap on the strip first". It works once he drags strokes apart on the strip. Also, `buildTimedSchedule` returns null for a take with no rows, so the picker needs slots from somewhere on an untouched take: build the schedule with one neutral row, which gives the base slots unchanged.

**How the UI lane offers these.** A "Camera" picker at the head of the camera rows in the key lanes. Each entry shows its label and the reason line beside it (the `BEAT_NOTES` pattern), and the tracks it will write. Choosing one calls `tryCameraMove(move, { slots, takeMs, keys })` and writes the returned keys into the take's `keys` as plain keys, replacing only the tracks that move names, in one undo step. From then on they are his keys: diamonds on the lanes, draggable, with the curve editor on each span. A move that refuses stays in the list, greyed, with its refusal as the tooltip, so he sees why it cannot run on this take and what to change. The picker keeps no link back to the move, so there is nothing to fall out of sync when he edits a key. A later Record button feeds a sampled camera path to `thinKeys` and writes the result the same way.

**Not decided, his call.** The default angles (30 deg across the lifts, 40 deg depth turn, lean x0.8 and +8 deg) are starting numbers, not measured against a render; no browser ran tonight. Whether Lean in should ease back out after the pause, or stay close as it does now. Whether Depth turn should go to a true 90 deg: that ends edge-on on the 24 px sliver, so the word is unreadable in the last frame.

**Not checked.** No render, no browser, no dev server, by the lane's rule. Nothing proves the camera follows these keys on screen; that is the UI lane's gate. LOG.md was not touched, since it is outside this lane's paths; this note is the handoff.

### F118 ANIM-3H note, 2026-09-26: NOT MERGE-READY. Two of the six runs are not done: `assert-take-timeline` and `measure-dock.mjs --tag=after` never ran, because the lane hit its context line. The four gates the dock broke are green: key-lanes 11/11, stroke-strip 18/18, perform 12/12, timing-browser `--grade-solid` 38/38.

Branch `lane/curves` in `~/.fs-lanes/curves`, from `9fb26e044`. `tsc` not run. The dev server on :3138 was killed by pid after its cwd was checked, and `.next/` is deleted.

**The marker.** `data-take-dock` sits on the dock host in `components/viewport-3d.tsx`, the root that turns into the flex column, and only while it docks (`docked || undefined`). It changes nothing he sees. It went on the host, not the panel, because the panel mounts only once there are strokes, and the gates have to float it before any stroke lands.

**The helper.** `scripts/verify/lib/undock.mjs` exports `UNDOCK_CSS` and `undock(page)`. The stylesheet drops the host's 64 px pad and takes the panel out of flow at main's floating spot, 12 px in and 64 px up. The panel is found as the host's child holding `[data-take-timeline]`. No Tailwind class is read. `undock` adds the style, then waits for `[data-take-dock]` and throws by name if it never appears. It throws on main as well, so base runs do not call it.

**The proof, at 1512x982, reading the 3D canvas's drawing buffer:**

| page | at mount | after the strokes |
| --- | --- | --- |
| with `undock` | 755x890 | 755x890, panel `position: absolute` |
| without | 755x826 | 755x533, panel `relative` |
| a page with the old Tailwind classes and no marker | `undock` threw: "no [data-take-dock] on the page after 3000 ms" | |

**Which pages undock, per gate:**

- `assert-key-lanes`: row 11's own page, as before. It now calls the helper instead of a local stylesheet.
- `assert-stroke-strip`: row 0 gets its own page, undocked. Every row after it drags the strip, so those run in a fresh docked page. Each page gets a fresh context, because the drawing persists in `localStorage` and would come back on a reload.
- `assert-perform`: rows R1 to 7 drive the Perform stage, so they stay docked. Row 8's three pictures (no rows, the dwell row set, after an Esc) now come from a fresh undocked page at the end. The docked page still grabs its opening picture, since row 1a's arm reads the take from it.
- `assert-stroke-timing-browser`: its one page undocks in the lane phase. No row reads the strip.

| gate | result | the rows that broke on the size |
| --- | --- | --- |
| `assert-key-lanes` | 11/11 | 11: 5/5 frames equal at 755x890; with the 0 to 30 key, 0/5 |
| `assert-stroke-strip` | 18/18 | 0: 0/18 frames differ; the 300 ms control changed 1/9 |
| `assert-perform` | 12/12 | 8: rod 9/9, inflate 9/9, after Esc equal; the dwell row's frames differ |
| `assert-stroke-timing-browser --grade-solid` | 38/38 | 6a: 25/25 on all four engines. Inflate 3: ink at the midpoint 0.000, knockout 0.465. Inflate 5: 2 px differ, knockout slope 54 px |
| `assert-take-timeline` | NOT RUN | |
| `measure-dock.mjs --tag=after` | NOT RUN | |

No bar moved. Next step: run the last two on this branch, then `tsc` against the baseline of 6.

### F118 HARDEN-B3 note, 2026-09-26: base provenance DONE for the presets gate. 46 of 46 graded rows pass, and the two rows against main `347e22e6b` read SELF, which is right on a lane that changes only scripts.

1. DONE. `scripts/verify/lib/server-commit.mjs`, 12 of 12 probe checks.
2. DONE. Wired into `assert-custom-presets` record and compare.
3. DONE. Bases `ea31c5b38` and `347e22e6b` recorded again from clean sparse worktrees, both removed and confirmed gone. Record mode refused a wrong label and refused recording on this branch.
4. DONE. Gate run from hardenB's own server: 46 of 46 graded, 2 SELF.

Branch `lane/hardenB` in `~/.fs-lanes/hardenB`, rebased on main `347e22e6b`. One dev server at a time on :3138, each cwd checked with `lsof` and killed by exact pid; one headless browser; `.next/` deleted. tsc not run: this lane changes only `.mjs` files and docs.

**The helper.** `serverCommit(port)` takes the listener pid from `lsof -nP -iTCP:<port> -sTCP:LISTEN -t`, reads its cwd, and walks up parent pids until a cwd sits in a git tree. It returns `{ pid, cwd, top, head, dirty }`, where `dirty` means `git status --porcelain -- app components lib hooks styles` is non-empty, untracked files included. It throws by name on no listener, on two different listener pids, and on a chain with no git tree; an lsof failure other than "nothing matched" throws too, so it never reads as "no server". `codeDiffers(srv, sha)` runs `git diff --quiet <sha> <head> -- <those five>`, or against the working tree when the server is dirty, where an untracked product file also counts. Git exit 128 (an unknown sha) throws, so "cannot tell" never reads as "same". Probe (`harden-b3-server-commit-probe.log`, script beside it), run from a throwaway sparse worktree of `/components/` at this branch, removed after:
- :3197 with nothing listening throws `no listener on :3197`.
- A plain listener in the clean worktree reads clean, with its own pid, cwd and HEAD. An appended line in `components/draw-in-timing-controls.tsx` reads dirty.
- `codeDiffers` reads false against the worktree's own HEAD and against `347e22e6b`, true against `ea31c5b38` and on the dirty tree, and throws on a made-up sha.
- A listener forked into a non-git cwd is followed to its parent in the worktree; a listener with no git tree up its chain throws `run in no git tree`.

**The gate.** Record mode (`--phase=base --base=<label>`) exits 2 unless the server is clean and its HEAD equals `git rev-parse --verify <label>^{commit}` in the server's repo. It reads the server again after the run and writes nothing if the pid, HEAD or cleanliness changed. Each base file now stores `sha`, `recordedFrom` and `at`. Compare mode exits 2 on a base file without a 40-hex `sha`, before it reads the server. A row whose base sha equals the served HEAD, or shows no code difference from it, prints SELF: outside the pass count, named in the summary, and it leaves the exit code alone. `347e22e6b` replaced `b2d3f2575` in `BASES`, since `c6c1024e1` added the Camera picker to main. `base-b2d3f2575.json` and its shot stay on disk, unread and without a sha.

**Refusals seen:**
- Compare on the old unlabelled `base-ea31c5b38.json`: exit 2, `has no stored sha` (`harden-b3-refuse-unlabelled-base.log`).
- `--base=ea31c5b38` on the `347e22e6b` server: exit 2, `is ea31c5b38b6a..., but the server on :3138 runs 347e22e6bc2b...` (`harden-b3-refuse-wrong-label.log`).
- `--base=347e22e6b` on hardenB's own server, the crosscheck's defect: exit 2, the server runs `4eb6ea3ea` (`harden-b3-refuse-record-on-branch.log`).

**The bases.** `ea31c5b38`: canvas `8f98fa9782acce83`, shot `36b502dceee98c53`, both equal to the old unlabelled file, and its shot png came out byte-identical. `347e22e6b`: canvas `8f98fa9782acce83`, shot `a866e4b1f4b13e51`, the hash HARDEN-B2 read off this tree. Opened `untouched-base-347e22e6b.png`: the take panel floats over the canvas and "Camera ^" sits at the right end of the Keyframes row. Both worktrees got main's `node_modules` by `cp -Rc`, per the recipe.

**The run** (`harden-b3-assert-custom-presets.log`): 46 passed of 46 graded, 0 failed, exit 0. The real comparisons are the two against `ea31c5b38`: canvas byte-identical PASS, and the must-fail shot differs PASS. SELF, by name: `untouched page: canvas byte-identical to main 347e22e6b` and `untouched page: screenshot byte-identical to main 347e22e6b`. Both matched, and neither proves anything here. They grade only on a lane that changes product code.

**For the next lane: `assert-resize-settles` and `assert-key-lanes` row 11.** Copy these rules exactly:
- `import { serverCommit, codeDiffers } from "./lib/server-commit.mjs"`, and call `serverCommit(Number(new URL(LAB_URL).port))`. It throws, so wrap it and exit 2 with the message.
- Record: exit 2 when `srv.dirty`, or when `srv.head !== git -C srv.top rev-parse --verify <label>^{commit}`. Read `serverCommit` again after the run and write nothing on any change of pid, head or dirty. Store `{ sha: srv.head, recordedFrom: srv.cwd, at }`.
- Compare: exit 2 on a base with no 40-hex `sha`, before touching the server. Then SELF when `base.sha === srv.head || !codeDiffers(srv, base.sha)`; `codeDiffers` throwing means exit 2. A SELF row is never PASS, sits outside the pass count, is named in the summary, and does not by itself fail the run.
- A gate that checks its own row count (key lanes has `rows.length === 16`) must count SELF rows in that total, or the count check fires on every SELF.
- Bases to record from clean sparse worktrees with the recipe above: resize `a8c03f2c8`, key lanes `ea31c5b38`. `nokeys-base.json` came from six files checked out into a lane tree (ANIM-3G), so none of its hashes are trusted.

**Still open, not this lane's:** `assert-perform --phase=base` stamps `head` from its own repo, not from the server, and `base-main.json` says `633f110f9` with no provenance. It needs the same four rules.

### F118 HARDEN-B2 note, 2026-09-26: `assert-perform` DONE, 15 of 15. The Reset row DONE, its must-fail firing on the real page. The presets gate is NOT green: 47 of 48, and the red row is the untouched-page screenshot against main `b2d3f2575`, broken by the Camera picker from `c6c1024e1`, not by this lane.

Branch `lane/hardenB` in `~/.fs-lanes/hardenB`, from `dfcede2ce`. Dev server on :3138 from this clone, killed by pid; one headless browser at a time; `.next/` deleted. tsc reads 6 errors, the baseline, none in either gate.

**`assert-perform`, 15 of 15** (`docs/verification/perform/harden-b2-assert-perform-run1.log`). Row 1b's cap held on every engine, and the 4 px must-fail went over it on every engine, so `NB_WIDE` stays 4 and the cap stays 5%:
- Solid: 25 of 873 left out, 2.9%. At 4 px, 155 of 873, 17.8%.
- Inflate: 16 of 600, 2.7%. At 4 px, 80 of 600, 13.3%.
- Extrude: 7 of 461, 1.5%. At 4 px, 47 of 461, 10.2%.

Each engine is a paired row, so its PASS means the control read false: the linear slot moved AND the 4 px share went over 5%.

Row 8's control now bumps each of the three clocks by 1 ms on its own, where HARDEN-B bumped only `takeMs`. With no take `takeMs` is null, so that arm is 1 against null; `penMs` and `totalDuration` carry the real 1 ms test, 13117 against 13116. All three read unequal, and the performed frames read unequal to main. The base is still `633f110f9` with no commit provenance, which is the base-provenance lane's item.

**`assert-custom-presets`, the Reset row** (`docs/verification/presets/harden-b2-assert-custom-presets.txt`). The test is now `[0, 1].every(c => ms.some(m => m.col === c)) && ms.every(besideOk)`. The old test passed with no fields at all (`0 >= 0`, a set of size 0, `[].every`) and with one column. Checked in Node on the two predicates: no fields and no marks, old true, new false; one column with one mark, old true, new false; two columns with one mark each, both true.

The must-fail is a new row, read on the real page after `selectPreset(p0)` and before any edit: 8 fields over 2 columns, 0 marks, the Reset test reads false. The row also requires fields in both columns, so an empty section cannot fire it. Both size rows pass with `ditherScale` in column 0 and `ditherContrast` in column 1, gaps 8 and 8.3 px, at 1512x982 and 1280x800, and the old-corner must-fails still fire at both sizes. Opened the 1280x800 shot: each "• Reset" sits right after its label.

**The red row belongs to LANES-UI.** `untouched page: screenshot byte-identical to main b2d3f2575` reads `a866e4b1f4b13e51` against `c918a9c84fea8188`. Diffed against the shot committed at F124 (`0218e15ee`, the last green run): 386 px differ, all inside 1425,816 to 1486,836, and the crop shows the new "Camera ^" button in the Keyframes row. `c6c1024e1`, LANES-UI-2 step 2, added that picker. Both canvas rows still match both mains. The row goes green one of two ways, neither this lane's: the picker stays off an untouched page, or the base is recorded again from a main that carries it (base-provenance item 3).

### F118 HARDEN-B note, 2026-09-26: NOT MERGE-READY. Stopped at the context line with one of four gates edited and none run.

Branch `lane/hardenB` in `~/.fs-lanes/hardenB`, on `a46d903c6`. No dev server was started, no browser was opened, `.next/` does not exist. Source of the findings: `docs/research-2026-09-26-codex-crosscheck.md`.

**Done, committed, NOT RUN.** `assert-perform.mjs`. Row 1b now caps the left-out share: `NB_CAP = 0.05` of the candidates (mask plus left out). Measured on `a6ee983f9`: 25 of 873 Solid, 16 of 600 Inflate, 7 of 461 Extrude. An empty candidate set reads share 1, so a blind mask fails the cap. The must-fail is the same frames read with a 4 px margin (`NB_WIDE`), folded into row 1b's paired control, so the row count stays 15. Nobody has seen that 4 px margin go over 5%; if it stays under, the control reads BLIND and NB_WIDE needs raising, not the cap. Row 8's `same` now compares `takeMs`, `penMs` and `totalDuration`; its control adds a take 1 ms longer. `base-main.json` already carries all three (takeMs null, penMs 13116, totalDuration 13116), so no re-record is needed for row 8.

**Left, in order, with the design worked out.**
1. `assert-custom-presets`, the F124 Reset row: pass only with 2 columns and at least one mark in each, `[0,1].every(c => ms.some(m => m.col === c))`. Must-fail on the real page: measure right after `selectPreset(p0)`, before any edit, where `ms` is empty; the same predicate must fail.
2. Base provenance, one helper copied into all three gates, because `scripts/verify/lib/` is outside this lane: find the server by port (`lsof -nP -iTCP:<port> -sTCP:LISTEN -t`, then `lsof -a -p <pid> -d cwd -Fn`), read `git -C <top> rev-parse HEAD` and `git status --porcelain -uno -- . ':(exclude)docs'`. Recording refuses a dirty tree and, for presets, a HEAD that does not start with `--base`; it stores `commit` and `cwd`. Comparing refuses a missing or malformed commit, a commit equal to the served HEAD, and a base with no product difference from the served tree (`git diff --quiet <base> -- . ':(exclude)docs'` exit 0; exit 128 means the commit is unknown, also refused). Must-fail: the same refusal run on the real base stamped with the served HEAD. It should become one file in `lib/` when that is open to a lane.
3. Re-record every base with a commit, each from a sparse worktree (`/*`, `!/docs/verification/`) of this clone, then remove the worktree. The commits: presets `ea31c5b38` and `b2d3f2575`. Resize `a8c03f2c8`: its parent is the pre-fix main, and `f494b6349` is the fix. Key lanes `ea31c5b38`. The old `nokeys-base.json` came from six files checked out of `ea31c5b38` into a lane tree (ANIM-3G note), never from a clean commit, so its hashes must be recorded again, not trusted.
4. `assert-key-lanes` row 10. The export renders each frame through `renderStill` (grid hidden, shadow hidden only when transparent, `gl.render` at the buffer size when the scale is 1), then calls `drawImage` from the GL canvas into a 2D canvas. The existing wrapper already fires there. After the original call, copy `src` into a scratch canvas with `orig.call` (calling the patched method recurses), FNV-hash the RGBA and keep every 25th frame whole for diffs. On the live side, hide the grid through the R3F store (reach it through the fiber the way `assert-resize-settles` `open()` does), seek to each recorded clock, and hash the GL canvas the same way (`preserveDrawingBuffer` is on). Run 2's export hashes must equal run 1's from frame 1. If the frames cannot be read, the row name says so and the row fails. `close()` becomes `Number.isFinite(a) && Number.isFinite(b) && |a - b| <= 1e-6`. Unkeyed properties are checked as undefined on both sides by name, and a missing camera fails. Must-fail: `close(NaN, NaN)` and `close(undefined, undefined)` must be false, printed in the row. Still unread: the encoded file, where codec loss and the container live.
5. Run all four: presets 47+, perform 15/15, key lanes 16+ (the exit check's `rows.length === 16` has to move if a row is added), resize with every fix row passing and the off rows failing as designed. tsc baseline is 6 errors.

**Also seen, not asked:** `assert-perform --phase=base` stamps `head` from the script's own repo (`execSync` with `cwd: ROOT`), not from the server, which is the same provenance gap as item 2. `base-main.json` says `633f110f9`.

### F118 ANIM-3G note, 2026-09-26: GATE DONE. `assert-key-lanes.mjs` is 11 of 11, every must-fail firing. Row 11 was failing on the instrument, not the product: with no keys the branch renders byte-identical to `ea31c5b38` at the same window and canvas, 5 of 5.

Branch `lane/curves` in `~/.fs-lanes/curves`, on `2a61cff34`. No product change: every comparison under equal conditions matched before any file was reverted, so no bisect ran. `tsc`: 6, the baseline, none in a file this lane touched. The dev server on :3138 was killed by pid after its cwd was checked, `.next/` is deleted, and no base worktree was made.

**What moved the pixels.** Two things, and neither is the no-keys path.

1. **The window.** `canvasHeight = innerHeight - 48` sets the stroke-to-world scale, `3 / max(canvasWidth, canvasHeight)`. ANIM-3F grew the window to 1339 to match the canvas, and the taller window alone moves every frame. Main against main, canvas held at 755x890 in both, 1339 against 982: 0 of 5 equal, 54,082 px apart at p 1. In the frames the mark sits in the same place at nearly the same size, because the camera frames it, while the ground grid around it comes out about 1.4 times larger and the line reads a little heavier. So it is a scale of the grid against the mark. No shift explains it: the best integer shift within 4 px still leaves 52,675 px apart. `row11-main-982.png` and `row11-main-1339-pinned.png`.
2. **The canvas's size history.** At 1339 the docked canvas mounts 1183 px tall and shrinks to 890 when the dock appears with the strokes. Against main at the same window with its canvas at 890 from mount, 8,820 px differ at p 1, every one on an edge: the mark's outline, three vertical grid lines, dots along the diagonals. The dark ink differs by 24 and 30 px, so the whole view moves by a fraction of a pixel. `row11-docked-history-diff.png`, red is a changed pixel. I did not trace this to a line, and I did not check whether main does the same when its own canvas is resized after the strokes land.

With no keys the brief's candidates are all inert, read off `__fsKeySample()`: `keyed` false, `lengthMs` equals `takeLen` at 13116 ms, `cameraWrites` 0, applied depth 1 and yaw 0.

**The proof at equal size.** Main was served by checking the six changed files out of `ea31c5b38` into this tree, then restored with `git checkout HEAD`; `key-lanes.tsx` is imported by nothing at the base. Main's page proved it was main: no `__fsKeySample`, the floating panel, and a 755x890 canvas at 982 with no stylesheet, where the branch gives 755x533.

| branch against main | window | canvas | frames equal |
| --- | --- | --- | --- |
| dock floated by a test stylesheet from mount | 1512x982 | 755x890 | 5 of 5 |
| the same, canvas pinned at 890 on both | 1512x1339 | 755x890 | 5 of 5 |
| dock as shipped, main pinned | 1512x1339 | 755x890 | 0 of 5, the size history |
| main at 1339 pinned, against main at 982 | differ | 755x890 | 0 of 5, the window |

Main's five hashes repeated across three runs.

**The gate change.** Row 11 now grabs in its own page at the base's window, with a stylesheet that floats the dock over the canvas as main does, added before the strokes land, so the canvas is 755x890 from mount. The must-fail moved into that same page, where the only change is a 0 to 30 azimuth key. The old must-fail grabbed in the docked page at 755x533, so it fired on the size alone and could not show that it sees a key. `nokeys-base.json` now records its window and canvas, and a run at another window or canvas fails row 11 by name. Shown firing: `--vh=1339` reports row 11 BLIND, "window 1512x1339 against the base's 1512x982", 10 of 11. Rows 1 to 10 run in a fresh page with the dock as shipped, unchanged.

| row | result | number |
| --- | --- | --- |
| 1 "+" writes a key at the playhead | PASS | key at 5246 ms for a playhead at 5246.4 ms |
| 2 dragging a diamond | PASS | 60 px on 634: 5246 to 6487 ms, expected +1241.3 |
| 3 azimuth key moves the view | PASS | 28,941 px, camera 22.5 to 67.5; the 0 to 0 key moves 0 px |
| 4 turn key | PASS | yaw 0.393 to 1.178 rad, 2,597 px |
| 5 depth key | PASS | applied scale.z 0.4 to 0.8, 114 px |
| 6 draw hold at 40% | PASS | 28,800 across the hold, 72,960 of 72,960 at the end |
| 7 curve handle drag | PASS | midway 0.5000 to 0.6546, expected 0.6546 |
| 8 hold holds | PASS | 0, 0, 0, 90 |
| 9 one undo, one edit | PASS | 1 to 2 keys, undo, 1 |
| 10 export matches live, twice | PASS | 0 of 413 frames differ in both runs |
| 11 no keys against `ea31c5b38` | PASS | 5 of 5 at 1512x982, 755x890; with the key, 0 of 5 |

Rows 3 to 5 read fewer pixels than ANIM-3F's because this run is at 982, where the docked canvas is 755x533, not 1339.

Still unrun on this branch: the regressions in the ANIM-3D note's step 2.

### F118 ANIM-3F note, 2026-09-26: GATE NOT DONE. Row 11 blocks it: with no keys, the branch's GL frames differ from `ea31c5b38` at 5 of 5 playheads, at the same canvas size. Rows 1 to 10 pass, each with its must-fail shown firing.

Branch `lane/curves` in `~/.fs-lanes/curves`, commit `1f52bee30` on `17f72d814`. No product change: no row proved a bug in `key-lanes.tsx`, so that file is untouched. The dev server on :3138 was killed by pid after its cwd was checked, the sparse base worktree is removed, `.next/` is deleted.

**The gate.** `scripts/verify/assert-key-lanes.mjs`. Run it twice: first against a server on the base commit with `--nokeys-only --label=base`, which writes `nokeys-base.json`, then against the branch with `--vh=1339`. Without the base file row 11 fails; it never passes by absence. Results in `docs/verification/keyframes/assert-key-lanes.json`. Length of the logo take: 13116 ms.

| row | result | number | must-fail, fired |
| --- | --- | --- | --- |
| 1 "+" writes a key at the playhead | PASS | playhead 5246.4 ms, key at 5246 ms, 0 to 1 keys | the doc before the click (0 keys), and a playhead 500 ms away |
| 2 dragging a diamond changes tMs | PASS | 60 px on a 634 px axis: 5246 to 6487 ms, expected +1241.3 ms | a zero-distance press: 6487 to 6487 |
| 3 azimuth key moves the view | PASS | 0 to 90: 51106 px changed between 3279 and 9837 ms, camera 22.5 to 67.5 | 0 to 0 key: 0 px, camera 0 to 0 |
| 4 turn key turns the mark | PASS | yaw 0.393 to 1.178 rad, 8470 px | 0 to 0: yaw 0 to 0, 0 px |
| 5 depth key changes depth | PASS | sampled 0.4 to 0.8, applied scale.z 0.4 to 0.8, 708 px | flat 0.6: applied 0.6 to 0.6, 0 px |
| 6 draw hold at 40% | PASS | 27840 drawn at five clocks across the hold, 69984 of 69984 at the end | the same span without the hold rises, 29376 to 48096 |
| 7 curve handle drag | PASS | handle y 0.25 to 0.663 for 21 px of 52; midway 0.5000 to 0.6546, expected 0.6546 | the post-drag sample against the pre-drag curve, off by 0.1546 |
| 8 hold holds | PASS | azimuth at 10, 30, 55, 62%: 0, 0, 0, 90 | linear ease out: 15.0, 45.0, 82.5, 90 |
| 9 one undo, one edit | PASS | 1 to 2 keys, undo, 1, equal to the doc before the last edit | the doc before undo, and the doc two edits back |
| 10 export matches live, twice | PASS | 0 of 413 frames differ in both real Video exports, and the runs match | run 2 against live after the azimuth end key moves 60 to 90: 412 of 413 differ |
| 11 no keys, byte-identical to `ea31c5b38` | FAIL | 0 of 5 frames equal, at p 0, 0.25, 0.5, 0.75, 1 | a 0 to 30 azimuth key: 0 of 5 equal, so it fires, but the arm it guards is already red |

**How row 10 reads the export.** The real "Save the animation" button runs the export. While it runs, a `drawImage` wrapper records `__fsKeySample()` every time the GL canvas is drawn into the frame. Afterwards the page seeks live to each recorded clock and compares the sampled values, the applied depth and yaw, and the camera pose. Frame 0 of each run is grabbed before the first seek, at the playhead the page held, so the run-to-run comparison starts at frame 1.

**Three instrument errors, found and fixed in the gate, none in the product.** The lane row's width includes the 72 px label gutter, so the axis is 634 px, not 706; the first run read 1241 ms against an expected 1115. The export compared unkeyed properties as `undefined` against `undefined` and called them different. And live was first seeked by `live.playhead` instead of by the sampled clock over the keyed length.

**Row 11, what is known.** At a 982 px window the branch canvas is 755x533 against the base's 755x890, because the dock sits under the canvas. At `--vh=1339` the sizes match, 755x890, and the bytes still differ at all five playheads. The base frames repeat byte for byte across two runs, so the base side is stable. `ea31c5b38` is an ancestor of the branch, and seven files differ in `app`, `components` and `lib`. I did not find which change moves the no-keys pixels; that is the next lane's first step. Diff one branch frame against one base frame in the same page, to see whether it is the scene, the grid or a shift.

After the gate, the regressions in the ANIM-3D note's step 2 are still unrun on this branch.

### F118 ANIM-3E note, 2026-09-26: THE LAYOUT IS DONE, THE GATE IS NOT. The 2 px is fixed and measured 6/6; `assert-key-lanes.mjs` was never started, because the lane hit its context line first.

Branch `lane/curves` in `~/.fs-lanes/curves`, commit `733fb4f7e` on `8cb5cca38`. `tsc`: 6, the baseline, none in `key-lanes.tsx`. The dev server on :3138 is killed by pid and `.next/` is deleted.

**The 2 px came from the lane labels.** Each label is `truncate text-[10px]` with no line height of its own, so it inherits 1.5 and draws 15 px tall in a 12 px row, spilling 1.5 px above and below. The last lane's label, Distance, spills 1.5 px below the body, and `scrollHeight` rounds that up to 218 against 216. With the curve open it reads 318 against 316, because the curve opens above the Draw row and Distance is still last. I found it by walking the region's descendants for the lowest bottom edge: the label span ended at 217.5 px and everything else at 216. The fix sets `lineHeight` to `PITCH` on the label, and the text stays centred in its row.

**Measured**, `measure-dock.mjs --tag=after --shots`, numbers in `dock-after.json`. The measure now also checks the region. Where its rows fit, `scrollHeight` must equal `clientHeight` and no edge may fade. Where they don't fit, an edge must fade. For the must-fail I ran the same measure on the unfixed labels (`dock-pre3e.json`): it scored 3/6, failing lanes and curve at 1512 and lanes at 1280.

| size | state | overlap | region scroll/client | rows |
| --- | --- | --- | --- | --- |
| 1512x982 | closed | 0 | 144/144 | fit |
| 1512x982 | lanes | 0 | 216/216 | fit |
| 1512x982 | curve | 0 | 316/316 | fit |
| 1280x800 | closed | 0 | 144/144 | fit |
| 1280x800 | lanes | 0 | 216/216 | fit |
| 1280x800 | curve | 0 | 316/217 | capped, both edges fade |

**Two more fixes in the same file, both found in the shots:**
- The Draw key at the end of the axis drew as half a diamond, "<", because it is centred on 100% and the region clips x. The region now reaches 6 px into the strip's 12 px right padding and pads it back, so the key is whole and the axis stays where it was.
- That fix exposed the lanes' playhead at 100% (progress 1) as a line on the right edge, while the band still clipped its own clock line there. The playhead layer is now clipped to the lane column, so both hide it, as they did before.

**What I saw in the six final shots.** `after-lanes-1512` and `after-lanes-1280`: "Strokes" and the first bar are crisp at the top with no fade, all six lane labels sit in their rows, and the Draw diamonds are whole at both ends. `after-curve-1512`: the same, with the curve box, the four fields and the three presets between the band and the Draw row, and no fade anywhere. `after-curve-1280` is the capped state. The top fades over the first bar in view and the bottom fades over Depth, so the region reads as holding more, and it does, 316 against 217. The Draw row and both of its diamonds are in view. `after-closed-1512` and `after-closed-1280`: the band alone, no fade, the Keyframes row under it. One thing outside my files: at 1280 the Debug button touches the card's right edge.

**Not done: step 2, `scripts/verify/assert-key-lanes.mjs`.** No file exists yet. The next lane writes it from the brief's 11 rows, each with a must-fail shown firing. ANIM-3C's 11-row draft below lists the hooks. What that lane can reuse from here:
- `measure-dock.mjs` already has a working setup: `injectStrokes` with `logo-strokes.json` at `msPerPoint` 12 and `gapMs` 60, `setEase("linear")`, `setPlaying(false)`, a wait for `__fsTake` and `__fsSetKeys`, then `__fsSetKeys({ drawProgress: [...] })`, which returns the list of refusals.
- A diamond drag maps px to ms through the lane row's `clientWidth` over `data-length-ms`. The lane column starts 72 px in (`KEY_GUTTER_PX`).
- The no-keys row compares against `ea31c5b38` in a sparse base worktree, removed after.

After the gate, the regressions in the ANIM-3D note's step 2 are still unrun on this branch.

### F118 ANIM-3D note, 2026-09-26: NOT MERGE-READY. The dock is built and measured 6/6, but none of the five regression gates has run, and the lanes-open states scroll 2 px they should not.

Branch `lane/curves` in `~/.fs-lanes/curves`, commits `f691c2520` (the build) and `9c1ee4b07` (measure, shots, region fade). The lane stopped at the 150k context gate before the regressions.

**Built.** In the single live view the take panel sits in flow under the canvas; the canvas pane is `min-h-0 flex-1` and shrinks (`docked` in `viewport-3d.tsx`). The panel is capped at 55% of the root's content box, so the canvas never gets less than 45% of it. The camera and export row keeps the bottom 64 px. `captureMode` and 3-Up keep the old overlay. The timing note folds to its verdict line, the one sentence that changes with the drawing, and a chevron opens the whole paragraph, unchanged. The strip's band and the key lanes scroll as one region (`data-take-scroll` in `key-lanes.tsx`); the band no longer scrolls by itself while the lanes are mounted. Opening a curve scrolls its whole lane into view, 16 px clear of the edge. An edge with rows behind it fades over 16 px, since overlay scrollbars show nothing. The PNG panel reads the still's size off the canvas, not the container. `tsc`: 6, the baseline.

**Measured**, `measure-dock.mjs --tag=after --shots`, numbers in `dock-after.json`, against `dock-before.json` (48 to 220 px of overlap in all six):

| size | state | overlap | canvas h | panel h |
| --- | --- | --- | --- | --- |
| 1512x982 | closed | 0 | 533 | 281 |
| 1512x982 | lanes | 0 | 461 | 353 |
| 1512x982 | curve | 0 | 361 | 453 |
| 1280x800 | closed | 0 | 351 | 281 |
| 1280x800 | lanes | 0 | 279 | 353 |
| 1280x800 | curve | 0 | 278 | 354, capped |

In all six the mark sits inside the canvas, rows keep their 12 px pitch, key diamonds are 12x12 and curve handles 16x16. The folded note is 27 px tall, down from 68 and 82.

**What I saw in the shots.** `after-closed-1512`: the canvas ends at a clean edge with the whole mark on the grid, and the panel reads as its own pane under it. The verdict line fits on one line, and its chevron lines up with the Keyframes chevron. `after-curve-1280`: this is the capped state. The curve box, its fields and presets, and the Draw lane with both keys are all in view. Depth shows ghosted in the bottom fade and the top bars fade out, so the region reads as holding more. The mark is small in a 278 px canvas, but whole. `after-lanes-1280` and `after-curve-1512`: all six lanes are visible, BUT the top of the region is faded and "Strokes" is ghosted in a state where everything should fit. The mark comes out the same size in the closed, lanes and curve states at each window size and only moves up as the canvas shrinks, so opening the lanes never makes it jump in size. I did not re-open `after-closed-1280` or `after-lanes-1512` after the final run.

**What blocks it, in order:**
1. The lanes-open region is 2 px taller than its cap: `scrollHeight` 218 against 216, and 318 against 316 with the curve open. Something in the lanes body renders 2 px more than `LANES.length * PITCH`. The scroll into view then moves 2 px and fades the top in a state that fits. Find those 2 px (or read the body's `offsetHeight` for the cap), re-run the measure, and re-open all six shots.
2. Run `assert-stroke-strip` 18/18, `assert-take-timeline` 21/21, `assert-perform` 12/12, `assert-stroke-timing-browser --grade-solid` 38/38 in full, and `assert-still-export`, which must still match the viewport. None of them has run on this branch.
3. `scripts/verify/verify-timing-note.mjs` reads the note with `innerText`. Folded, it now gets the verdict line only. It is a capture tool, not a gate, and I did not change it.

### F118 ANIM-3C note, 2026-09-25: NOT MERGE-READY. The layout is not built. The lane hit its context line after measuring the old layout and choosing the fix.

Branch `lane/curves` in `~/.fs-lanes/curves`. `75a94507d` (the off-scope LOG.md commit) is reverted as `807729b66`. Nothing in `components/` or `app/` changed.

**The old layout covers the mark in every state, at both sizes.** Read by `docs/verification/keyframes/measure-dock.mjs`: 12 strokes from `logo-strokes.json`, progress 1, Draw keyed 0% at 0 s and 100% at the end. The mark's box comes off the GL frame (progress 0 against progress 1, any channel moved by more than 48), the panel's box off the DOM. Numbers in `dock-before.json`, shots `before-{closed,lanes,curve}-{1512,1280}.png`.

| size | state | mark y | panel top | overlap |
| --- | --- | --- | --- | --- |
| 1512x982 | closed | 418 to 644 | 596 | 48 px |
| 1512x982 | lanes | 418 to 644 | 524 | 120 px |
| 1512x982 | curve | 418 to 644 | 424 | 220 px |
| 1280x800 | closed | 352 to 531 | 400 | 131 px |
| 1280x800 | lanes | 352 to 531 | 328 | 179 px |
| 1280x800 | curve | 352 to 531 | 228 | 179 px |

That table is the must-fail for the fix. In `before-curve-1512.png` the only piece of the mark left in view is the top of the D.

**Why the panel cannot stay over the canvas.** The camera centres the mark in the whole view, so the room under it is fixed: 262 px at 1512x982 (mark bottom 644, panel floor 918, a 12 px gap) and 193 px at 1280x800. The closed panel alone is 322 and 336. No max height, compact row or folded paragraph fits the strip, six lanes and a curve into 193 px, and a taller drawing would leave less.

**The fix I chose: the panel docks below the canvas, and the canvas shrinks to fit.** The lab is perspective (`projection` defaults to "perspective" when no `flatten` is passed), so a shorter canvas keeps its vertical field of view and the mark scales down about its own centre. It stays whole whatever the panel's height. Every timeline editor he would compare this to (After Effects, Spline, Blender) gives the timeline its own pane for the same reason. On its own, docking leaves 1280x800 with a canvas about 125 px tall with the curve open (708 less 508 of panel, 64 of camera row and a 12 px gap), so it ships with two cuts:
- the timing paragraph folds to one line with a disclosure, the full text one click away;
- the strip and the lanes share one scroll region with a max height, so the canvas keeps about half the view. Rows stay 12 px and the grips keep their 12 px and 16 px hit boxes.

**Two things to rule before it is built:**
- PNG export renders at the canvas's CSS size (`renderStill`, `gl.setSize(size.x, size.y)`), so a docked canvas exports a shorter, wider PNG than today. It still matches the viewport, which is what `assert-still-export` checks, but the default aspect changes.
- `captureMode` pins the root at 1920x1080 and 3-Up lays out three canvases in a grid. Both keep the panel over the canvas; docking applies only to the single live view.

**Next lane, in order:** root of the single view becomes a flex column (canvas wrapper `min-h-0 flex-1`, panel in flow above the 64 px camera and export row), the paragraph fold and the scroll cap, then `measure-dock.mjs --tag=after --shots` (overlap must read 0 in all six rows, mark inside the canvas), open the six shots, then `assert-stroke-strip` 18/18, `assert-take-timeline` 21/21, `assert-perform` 12/12 and `assert-stroke-timing-browser --grade-solid` 38/38. `tsc` baseline is 6.

**The key-lanes gate, 11 rows.** The ANIM-3B facts the brief pointed to were not in it, so these are drafted from `components/key-lanes.tsx`:
1. `+` adds a key at the playhead with the value the view shows (`data-key-add`, read back through `__fsKeys`).
2. `+` at a time that already has a key selects that key and adds nothing.
3. Dragging a diamond moves `data-t-ms`, clamps between its neighbours, and one ⌘Z undoes the whole drag.
4. The lanes' axis (`data-length-ms`) holds still for the length of a drag.
5. The Time field re-sorts the track; a time another key holds is refused, with the reason in `data-key-reason`.
6. The Value field writes the shown value divided by the lane's scale (`data-key-value`).
7. Delete, Backspace and `data-key-delete` remove the selected key.
8. Clicking a span opens its curve (`data-key-span`, `data-key-curve`); Escape shuts it.
9. Dragging a handle writes that span's easeOut or easeIn (`data-curve-handle`, `data-x`, `data-y`), one undo step.
10. Easy Ease, Linear and Hold write their eases and press their buttons (`data-curve-preset`, `aria-pressed`).
11. The speed fill agrees with what the view plays: `__fsKeySample` at several clocks against `sampleTrack` (`data-curve-speed`, `data-curve-box`).

Hooks the page exposes: `__fsKeySample`, `__fsKeys`, `__fsSetKeys`; `data-key-lanes` and `data-open`, `data-key-lane`, `data-key-count`, `data-key`, `data-selected`, `data-key-selected`, `data-key-time`, `data-key-playhead`; `data-curve-num` for the four bezier fields.


### F118 ANIM-4F note, 2026-09-26: NOT MERGE-READY. The Customize layout is built and measured on Fusion at 1512x982, but the lane hit its context line before the other shots and before any gate or regression ran on this tree.

**What blocks it:** (a) Not shot yet: Fusion at 1280x800, and Dither at 1512x982 and 1280x800. (b) Not run on this tree: `assert-custom-presets` (43/43 expected), `_probe-customize-leaks.mjs` (0 leaks), `_probe-customize-coverage.mjs` (exit 0), `assert-stroke-strip` 18/18, `assert-take-timeline` 21/21, `assert-key-lanes` 11/11.

Branch `lane/presets` in `~/.fs-lanes/presets`, rebased onto main `v0/sebastianmmdesign-3308-12049aa9` with no conflicts. Head `5e321b148`. tsc: 6 errors, the baseline. Dev server on :3138 killed by pid after its cwd was checked; `.next/` deleted.

**What changed, all in `components/style-panel-scaffold.tsx`:**
- The Presets panel no longer caps its body at 672 px (`max-w-2xl`). The picker rows and notes carry `max-w-lg` themselves, so only Customize got wider. The brief's "one 512 px column" was really this cap: Customize measured 672 px wide and 2,871 px tall on this tree before the change.
- One section per system, each with a small heading named for its tab: Fusion, Layers, Material, Texture, Dither, ASCII, and Motion for Animation. A section with no field in scope hides, heading and all (`has-[[data-field-keys]]`). The names sit in a map beside `customizeControlsFor`, since the leak and coverage probes read that function's body as text.
- Fields flow down two columns (`columns-md`, 24 px gap). That is two columns from a 920 px drawer up and one below it. No field splits across columns. Each control's flex root becomes `display: contents`, so fields flow as plain blocks: 16 px apart, and 24 px above a motion group. A flex item's margin is not cut at a column break, which left ASCII's right column 8 px low; a block margin is cut.
- Every group rule in Customize is gone. The first one divided the Drive group from a picker Customize hides (the stray rule under the header). A column could also start on one, and ASCII Animation's did.
- Save as mine sits in the header beside Reset all, and its name field opens under the header, where Rename's does.
- "Customize" is now 14 px semibold (the drawer's h3 size), so it outranks its 12 px semibold system headings. Before, at 12 px medium, it read lighter than they did.

**Measured, `FS_PORT=3138 FS_HEADED=0 node scripts/verify/_probe-customize-look.mjs after fusion 1512x982`, ALL OK (Whole Cloth, 48 fields, Link edited):**
- Customize is 1262 x 1,762 px. It was 2,769 px in the ANIM-4E shot and 2,871 px on this tree before the change.
- On first open (drawer scrollTop 0, visible y 104-520), Save as mine and Reset all both sit at y 409-436.
- Every system uses two 619 px columns, and both column tops line up in each. Section heights: Fusion 108, Layers 476, Material 77, Texture 160, Dither 320, ASCII 274, Motion 105.
- No field name repeats inside a section. "Opacity" (x3) and "Blend" (x2) do repeat as sub-labels in Layers, but each sits inside its own titled card (1 · Texture (base), 2 · Dither, 3 · ASCII), which is the field's name. Renaming them would mean editing `LayersControl`, which this lane does not own.
- Across sections, "Speed" appears 5 times, and "Cell size", "Contrast", "Lock mode", "Behaviour" and "Direction" each appear more than once. Each now sits under its system's heading.
- No first block and no group keeps a top rule.

**What I saw, `customize-fusion-after-whole.png`:** the systems split well. Static settings run down the left column, and each "... Animation" block starts the right column (Texture, Dither, ASCII), so motion lives on the right in every system. The Layers cards stay whole on the left, with Order and Stack Animation on the right. Beside Material and Motion, each only one field, the right column is empty, a 620 px hole twice. In the header, the two buttons sit about 1,100 px right of "Customize". They are in view, but the eye has to cross the drawer to reach them. The page shot `customize-fusion-after.png` shows the header, the Fusion heading and the Drive and dial row in the drawer's first view.

**Left, in order:** (1) `_probe-customize-look.mjs after fusion 1280x800`, `after dither 1512x982` and `after dither 1280x800`; open every shot. At 1280 the drawer may fall under 920 px, which gives one column; if so, pick a column width that holds two. (2) `assert-custom-presets` 43/43, `_probe-customize-leaks.mjs` 0 leaks, `_probe-customize-coverage.mjs` exit 0. (3) `assert-stroke-strip` 18/18, `assert-take-timeline` 21/21, `assert-key-lanes` 11/11. (4) Flip this note to MERGE-READY if all pass.

**His localhost steps, once it lands:** open `/`, Style bar, Preset chip, family Fusion, pick Whole Cloth. Customize now runs in two columns, with Fusion, Layers, Material, Texture, Dither, ASCII and Motion as headings, and Save as mine next to Reset all at the top. Move Link: a dot and Reset appear beside it. Press Reset and the picture goes back. Save as mine, rename it, delete it; the drawing keeps its look after the delete.

### F118 ANIM-4E note, 2026-09-26: NOT MERGE-READY. The gate is 43 of 43 and the leaks are fixed, but the Customize layout fix (step 4) and the regression runs (step 5) were not done: the lane hit its context line.

**What blocks it:** (a) Customize on a Fusion preset is one 512 px column, 2,769 px tall, in a drawer about 1,300 px wide; the fix below is designed, not built. (b) `assert-stroke-strip`, `assert-take-timeline`, `assert-key-lanes` and `_probe-customize-coverage.mjs` were not run on this tree.

Branch `lane/presets` in `~/.fs-lanes/presets`, rebased onto main `b2d3f2575` (RUN-QUEUE conflicts only, both sides kept). tsc: 6 errors, the baseline (5 in `lib/geometry-engines.ts`, 1 in `lib/dd-engine/handFeel.ts`). Dev server on :3138 killed by pid after its cwd was checked; `.next/` deleted.

**1. Delete keeps the picture; the row compared two canvas sizes.** `_probe-customize-delete.mjs`: deleting the active Mine preset leaves no active preset, so Customize unmounts, the panel loses about 178 px and the GL canvas grows from 755x449 to 755x627 within 60 ms. No settle can make two sizes hash equal, so this is not the F122 stale frame. The row now grabs before and after with the Presets panel shut, where the canvas is 755x890 on both sides, and each grab still forces the settle (size held, a no-op STILL `setStyle`, 600 ms). Both read `bc1e6df2`. New must-fail: at that size the Mine style differs from the untouched page. The first try read the canvas size before the resize landed and still passed; the size is now read after the grab.

**2. Leaks.** `_probe-customize-leaks.mjs` exited 0 with no arguments, having checked nothing. It now reads its controls from `customizeControlsFor` and exits 2 when there are none, or when they hold no `<Field>`. It named one leak: the draw-in timing section in `AnimationControl` (h4, p, `DrawInTimingControls`). Wrapped in `<Field k={[]}>`, since take timing is not a style field. Now 7 controls, 72 Field wrappers, 0 leaks.

**3. Base rows.** Sparse worktrees (no `docs/verification/`), node_modules cloned with `cp -c`, served on :3138 one at a time, both removed. On `ea31c5b38` the canvas is `8f98fa97` and the shot `36b502dc`; on `b2d3f2575` (undocked) `8f98fa97` and `c918a9c8`; this tree, undocked, `8f98fa97` and `c918a9c8`. The ea31c5b38 shot differs from this tree only inside the take panel (x 769-1499, y 618-917): main added the Keyframes row and folded the note. That is main's work, so the shot row now reads `b2d3f2575`, and the ea31c5b38 shot is a must-fail showing the row can see a chrome change. Evidence in `docs/verification/presets/`.

**Gate, `FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-custom-presets.mjs`: 43 of 43**, every must-fail firing, 0 flags forced. Output in `docs/verification/presets/assert-custom-presets-anim-4e.txt`.

**4. What I saw, `customize-fusion-before*.png` (Whole Cloth, 48 fields, Link edited):** the drawer shows about 400 px of Customize at a time, and Customize is 2,769 px, so about seven drawer heights of scroll while the right 760 px of the drawer sits empty. Seven systems run together with no headings: two "Cell size", two "Contrast" and five "Speed" fields, and nothing says which is dither and which is ASCII. A rule sits right under the Customize header: the Drive group's `border-t` separated it from the relationship picker, which Customize hides, so the rule now separates nothing. Save as mine is the last thing in the section, 2,700 px below Reset all. The edited dot and Reset read right on the Link field.

**Left, in order:** (1) In `PresetCustomize`: drop `max-w-lg` from the section; lay the controls out in columns the way the Animation tab does (F110, `columns-2xs`), probably `columns-md` for two columns at 1512, with `break-inside-avoid` on each `[data-field-keys]` and on bordered cards; give each control a small heading with its tab name (Fusion, Layers, Material, Texture, Dither, ASCII, Animation), shown only when it holds a field; drop the top rule of each control's first block; move Save as mine into the header beside Reset all, with its name input under the header where Rename's already goes. Rerun `_probe-customize-look.mjs after` and open the shots. (2) `assert-stroke-strip` 18/18, `assert-take-timeline` 21/21, `assert-key-lanes` 11/11, `_probe-customize-coverage.mjs` exit 0, then this gate again.

**His localhost steps, once it lands:** open `/`, Style bar, Preset chip, family Fusion, pick Whole Cloth. Under Customize, move Link: a dot and Reset appear beside it. Press Reset; the picture goes back. Save as mine, rename it, delete it; the drawing keeps its look after the delete.

### F118 ANIM-4D note, 2026-09-26: NOT MERGE-READY. The drift is found and the gate reads 37 of 40; one restore row still fails, and steps 2 to 5 were not run (context gate).

**What blocks it:** "delete works on the page and keeps the picture" still fails, cause not looked at. The two main rows need `--phase=base` on a sparse `ea31c5b38` worktree (not run). Not run either: the leak probe (step 2), the 1512x982 look (step 4), `assert-stroke-strip` and `assert-take-timeline` (step 5).

**p0 is Bayer Classic.** Line 68 and the browser rows both pick `dither/bayerClassic`, 9 fields, screen-locked. "Grain" was only the name the gate types into Save as mine. No dither preset animates and every grab ran with all flags already off: 17 grabs, 0 forced.

**The drift is not a clock. It is a stale frame after the GL canvas resizes.** Opening the Presets panel takes the GL canvas from 755x890 to 755x449, about 160 ms after the click. The frame drawn then sits a sub-pixel off from the frame drawn after the next Viewport3D render: every grid line and stroke edge moves, 19,876 px differ, max 233. It holds for as long as nothing re-renders (4.5 s sampled at 150 ms, one hash). `setProgress(1)`, `setPlaying(false)`, a no-op `setSpin(0)` and waiting leave it stale. `setStyle({})`, a new object with no field changed, settles it, and so does `setLoop(true)`, which is not style state. ANIM-4B's `applied` was that stale frame, and every grab after an edit was a settled one, so the restore rows compared two framings of one state. What in Viewport3D goes stale on a resize and refreshes on a render is not found; `viewport-3d.tsx` is outside this lane. For him it is a sub-pixel shift on the first touch after a panel opens.

**Proof, `scripts/verify/_probe-customize-drift.mjs`:** with motion off, two grabs 600 ms apart are byte-equal untouched (`8f98fa97`), after the preset (`d242301e`), after `ditherScale` 8 (`971b99f3`, again 2 s later) and after undo (`d242301e`, same as the preset). Positive control: turning dither on moves 3,759 px.

**Gate change, `assert-custom-presets.mjs`:** each grab waits until the GL canvas size holds for 250 ms, writes the STILL patch (motion off, every animation flag false; with identical values page.tsx records no undo step), pins the reveal, waits 600 ms, grabs, and throws if the canvas resized during the grab. New rows: two grabs at one state, nothing edited, byte-equal (`412c47a6` twice; the first frame after the panel opened was `d242301e`, the pre-resize one); two grabs after an edit and a field Reset byte-equal (`412c47a6`); every grab ran with the flags already off.

**Gate, `FS_PORT=3139 FS_HEADED=0`: 37 of 40.** Undo, field Reset and Reset all now restore byte-identical pixels, and every must-fail fires. Failing: delete keeps the picture, and the two main rows (no base file).

**Left, in order:** (1) find why delete moves the picture; it may be the same resize class, since the Mine group leaves the panel. (2) `_probe-customize-leaks.mjs`: make it fail on nothing to check, then fix what it names. (3) `--phase=base` on a sparse `ea31c5b38` worktree on :3139, then this tree. (4) Screenshot Customize at 1512x982 on a Fusion preset with one field edited and fix the gaps. (5) `assert-stroke-strip` 18/18, `assert-take-timeline` 21/21. tsc not rerun; no TypeScript changed.

**His localhost steps:** open `/`, Style bar, Preset chip, family Dither, pick Bayer Classic. Under Customize, move Cell size: a dot and Reset appear. Press Reset; the picture goes back.

### F118 ANIM-4C note, 2026-09-26: code side DONE for coverage, NOT browser-checked. Every field a preset sets now has its own panel control in Customize; nothing is left read-only.

**Coverage, fields with a `<Field k>` wrapper in a control Customize mounts, of the fields `presetFields` returns across the family:** material 1 of 1, animatedMaterial 4 of 4, texture 6 of 6, animatedTexture 10 of 10, dither 9 of 9, animatedDither 14 of 14 (was 13, motionMode), ascii 6 of 6, animatedAscii 9 of 9, layerStack 29 of 29, stackAnimation 6 of 6, fusion 50 of 50, animatedFusion 50 of 50. No field lacks a control, so the read-only list should now be empty for every shipped preset.

**Is the code side done?** Coverage, yes. One static check is still owed: every visible block inside a mounted control has to sit in a `<Field>`, or it shows for every preset of the family. I wrapped every block I read, but the check that walks the JSX and lists stragglers was written and not run (context gate). Nothing has been looked at in a browser.

**Commits on `lane/presets`:** 32577f340 Material, d814391d8 Texture plus motion mode, b9136f5b9 ASCII, 354fba980 Layer Stack, dd663bca8 Fusion. One file, `components/style-panel-scaffold.tsx`.

**Beyond the wrappers, because the wrappers do nothing without it:**
- `customizeControlFor` became `customizeControlsFor` and returns a list. Layer Stack mounts Stack, Material, Texture, Dither and ASCII; Fusion mounts those plus Fusion and Animation; the animated Texture, Dither and ASCII families add Animation for motionMode.
- `PresetCustomize` takes the panel's handlers (`onSelectPreset`, `cameraSpin`, `onSpin`, `onSelectCombo`), passed from `PanelControl`, the same values the Stack and Fusion tabs get. `LayersControl` and `FusionControl` require them.
- Blocks no preset sets carry their own key so they hide in Customize: customMaterial, texturePhase, the sync and delay pairs, styleLoopSeconds, customFusions. Preset pill rows and readouts with no field (the two stack pill rows, the stack presets block, the Animation category list, the combo caption) are wrapped with `k={[]}`: panel as before, never in Customize.
- `<Field>` with no scope still returns `<>{children}</>`, so every tab outside Customize renders the same DOM. That is read from the code, not measured.

**For his eye, real calls, not bugs:**
- fusionPreset's controls are pickers. The rail's built-in pills call `onSelectPreset`, so a click inside Customize switches the preset and Customize remounts on the new one. The combination picker sits in Customize too. Wrapped by the rule (a field with a control gets it); `k={[]}` hides them if he rules that out.
- stackAnimationSpeed is one field with two controls, Speed for size and Direction for sign, each wrapped, so an edit shows two dots. Either Reset puts both back.
- Layer Stack mounts 5 controls and Fusion 7. A control with nothing in scope still mounts its outer and inner layout divs, which can leave empty gaps. Look at the spacing.

**How coverage was checked (Node, no browser):** load `lib/style-system.ts` through `scripts/verify/_ts-load.mjs`, union `presetFields` per family over `ALL_PRESETS`, read the family-to-controls map out of `customizeControlsFor` in the scaffold, and collect the keys of every non-group `<Field k>` inside each mapped control's function. A group wrapper doesn't count, since it emits no `data-field-keys`. Positive control: before any change it read dither 9 of 9 and animatedDither 13 of 14, matching ANIM-4B. Must-fail: texture read 0 of 6 before its mapping, and fusion read 0 of 50 while the probe's regex missed a two-line `return`, which is how that probe bug surfaced. The script sits in the lane scratchpad; this lane owns no path under `scripts/`.

**tsc: 6 after every family**, all outside this file (perfect-freehand, MaskSolidDiagnostics). Positive control: one planted type error in the scaffold read 7.

**For the next lane, the browser one: the pixel drift ANIM-4B saw.** After one field edit, two grabs at the same style state came out different, so the restore rows can't be trusted yet. The controller's hypothesis: the tested preset animates, so the picture changes with the clock while the state stays put. What Node shows: none of the 5 shipped dither presets sets `ditherAnimated` or `motionMode` (each sets 9 fields), the defaults are `ditherAnimated: false` and `motionMode: "off"`, and no shipped preset has the id `grain` (texture has `fineGrain`, animatedTexture has `grainDrift`). ANIM-4B's "grain, 8 fields" matches none of them, so first find what preset `p0` really is (`inCorpus.find(...)` in `assert-custom-presets.mjs`, line 68). A preset only writes its own fields, so an animation flag left on earlier survives it. Either way:
1. Before every grab, stop motion: `setStyle({ motionMode: "off" })` through the harness, and turn off every `*Animated` and `materialAnimationEnabled` or `stackAnimationEnabled` flag, or pick presets whose `applies` sets them all false.
2. Prove it before trusting any restore row: two grabs at the same state, no edit between, byte-equal. Then the same after one edit and Reset. Paste both hashes.
3. If two grabs still differ with every flag off, motion is not the cause. Look next at a clock outside StyleState (reveal playhead, camera spin, the fusion drive), and note what `motionMode: "off"` leaves running (lane M on 09-25 found Material still moves under Off).

**Left, in order:** (1) run the JSX leak check on every mounted control. (2) Browser lane: the drift proof above, then ANIM-4B's steps 2 to 4 (base against main `ea31c5b38`, the 1512x982 screenshot, `assert-stroke-strip` and `assert-take-timeline`). (3) Screenshot Customize for one preset per family, Fusion and Layer Stack first, since they mount the most controls.

### F118 ANIM-4B note, 2026-09-26: NOT MERGE-READY. Customize, Mine, rename and delete work on the page; the pixel rows after an edit are not trustworthy yet.

**What blocks it:** after one field edit, two grabs of the canvas at the same style state differ (`again moved` in the gate's detail). Undo, field reset and Reset all put every style field back exactly (the state diff is empty), but the pixel hash still moves, so those three rows and "delete keeps the picture" fail. The drift shows with a keyboard edit and a pointer edit alike, and pinning the reveal clock before each grab did not stop it. Cause not found; the lane hit its context line. The byte-identity rows against main `ea31c5b38` were not run (no base file recorded), nor the 1512x982 screenshot, nor `assert-stroke-strip` and `assert-take-timeline`.

**Built, branch `lane/presets`, commits 6124ba47f and the gate commit after it:**
- **Customize** sits under the preset in the Presets tab. It lists the fields `presetFields` returns, each with the panel's own control. A `<Field k>` wrapper around each control block renders as before with no scope set; inside Customize it shows only the preset's fields, with a dot and a Reset when a field moves. Reset all puts back every field the preset sets.
- **Scoped so far: Dither and Animated Dither only.** The 9 Dither blocks are wrapped. Texture, ASCII, Material, Layer Stack, Fusion and their animated families still show their preset fields read-only, with the value and a Reset if edited elsewhere. Customize finds unwrapped fields from the page itself (a field with no `data-field-keys` goes to the read-only list), so a missing wrapper shows up instead of vanishing. No control was copied.
- **Save as mine** asks for a name inline. His preset leads the list under "Mine", with "Built in" below. Rename and Delete sit in the Customize header when a Mine preset is picked. Each is one `setStyleState` call, so one undo step.

**Gate, `FS_PORT=3139 FS_HEADED=0 node scripts/verify/assert-custom-presets.mjs`: 31 of 37.** Model rows 15/15, with the doc round trip now run through `validateSession`, the load path `doc-store.ts` exports, plus its must-fail. Browser rows on preset `grain`: Customize lists exactly the 8 fields, the edit moves pixels and shows its dot, the edit is one undo step, Save as mine then another preset then Mine gives the same pixels, rename and delete work and each is one undo. Failing: the four pixel-restore rows above and the two main rows (no base).

**Left, in order:** (1) find what moves the picture after an edit; start by grabbing twice right after `selectPreset` with no edit, then after `setStyle({ ditherScale })` through the harness. (2) `--phase=base` against a main `ea31c5b38` sparse worktree on :3139, then this tree. (3) Screenshot Customize at 1512x982. (4) `assert-stroke-strip` 18/18, `assert-take-timeline` 21/21. (5) Wrap the other families' controls. tsc: 6, the baseline.

**His localhost steps:** open `/`, Style bar, Preset chip, family Dither, pick Grain. Under Customize, move Scale: a dot and Reset appear. Press Reset. Move it again, Save as mine, name it, find it under Mine, Rename, then ⌘Z.

### F118 ANIM-4 note, 2026-09-26: NOT MERGE-READY. The preset model is built and gated; the Customize panel is not.

**What blocks it:** the Customize panel, pixels, undo on the page and the page-vs-main check are not built or run. The lane stopped at its 110k context cap after the model layer.

**Built, branch `lane/presets`, clone `~/.fs-lanes/presets`:**
- A saved preset of his is a `StylePreset` with a `mine:` id, kept in `StyleState.customPresets` next to `customFusions`. One preset system, one apply path: `applyPresetToStyleState` now looks up shipped presets, then his (`findPresetIn`).
- `presetFields` reads the fields off the preset's own `applies`. `presetEditedFields` names the ones he changed. Reset is a re-apply. `saveMinePreset`, `renameMinePreset`, `deleteMinePreset` each return one new state, so each is one recorded step through `setStyleStateRecorded`.
- `lib/doc-store.ts` validates the list on load: a bad preset or a field this build lacks is dropped and named in the repairs.
- The Style bar's Preset chip reads "Grain, edited" once a field moves off the preset. The undo label names his preset instead of its id.

**Gate, `node scripts/verify/assert-custom-presets.mjs`: 13 of 13, model only.** Corpus is 131 of 157 presets: every style-family preset with `applies`. Fields match the definition 131/131. Edit, reset byte-identical and save-re-applies each 118/118 (the 13 others set no number or toggle to move). Each row has a must-fail. The doc round-trip row did not run: `doc-store.ts` exports no `coerceDoc`, so the gate skipped it. Treat that row as not run, not passed.

**Families:** all 12 style families are covered by the model. Geometry (6), View and Geometry Animation (6) carry patches that are not style fields, so a preset there has zero Customize fields; custom for them needs the geometry and motion setters in `app/page.tsx`. No family on the 07-28 list is missing presets: Material, Texture, Dither, ASCII, Layer Stack, Fusion and each Animated one all ship members. No presets were invented.

**Left, in order:** (1) Customize in the Presets tab showing the family's own controls filtered to `presetFields`. The controls are monolithic per tab today, so this needs a field-scope wrapper in each control, not a second control set. (2) Mine group, Save as mine, rename, delete in the tab. (3) Browser rows: pixels move on edit, one undo step, page byte-identical to main untouched. (4) Screenshot at 1512x982. (5) `assert-stroke-strip` 18/18 and `assert-take-timeline` 21/21. tsc: 6, the baseline, none in touched files.

**His localhost steps, once the panel lands:** open `/`, Style bar, Presets, pick Dither and a preset, Customize, move one slider, watch the chip say "edited", Save as mine, find it under Mine, rename it, ⌘Z.

### F118 ANIM-2C note, 2026-09-25: MERGE-READY. Rod holds a performed dwell: row 1b holds the D for 1031.5 ms of a 1034.2 ms dwell.

Branch `lane/perform` in `~/.fs-lanes/perform`, on e04d04649. All four gates are green on this tree: `assert-perform` 12/12, `assert-stroke-strip` 18/18, `assert-take-timeline` 21/21, `assert-stroke-timing-browser --grade-solid` 38/38. tsc is 6 errors, the baseline, none in `viewport-3d.tsx`.

- **Why e04d04649 did not move row 1b:** the stage never got the pace. `Scene`'s `timed` memo (`components/viewport-3d.tsx` ~9004) copies each take row field by field so the knockouts can drop one, and it named four: `delayMs`, `speed`, `ease`, `holdBack`. `performed` fell off, `buildTimedSchedule` saw no pace, and `timedNow.performed` was null on all 12 strokes. Rod's `pf` test from e04d04649 was right and never fired. The strip builds its schedule from the take itself, so it drew the pace, and row 1a reads the take, so it passed.
- **Measured with a temporary readout on `__fsTake.get().live`, at 7 clocks inside a kept dwell on stroke 5:** Rod takes the `timedRodMs` branch (`winNow.identity` true, `schedNow.identity` true, the take not identity). `performed[5]` is false, and `rodMs[5]` walks 6697.8, 6786.0, 6874.2 ms across the hold, the same numbers as the row with its pace deleted. Rod's per-stroke timeline does not re-time it: `strokeNowMs` equals `rodMs[5]` at every clock and the drawn count follows it. After the fix `performed[5]` is true and `rodMs[5]` sits at 6747.7 ms from u 0.45 to 0.65, count 4896 at all five clocks. Receipts in `docs/verification/perform/`: `anim2c-probe-before.json`, `anim2c-probe-after.json`, the probe `anim2c-probe.mjs` (its header lists the three hook lines, removed before commit) and `anim2c-gates.txt`.
- **The fix:** one spread in that memo, so `performed` rides through when the row has one. No knockout drops it. Row 1b's must-fail deletes the pace from the row and still fails: linear draws 3744 -> 6432 across the dwell.
- **Outside the files I was given, named:** the memo is not Rod's clock, it feeds it. It is the one place the stage's rows are built, so the fix goes there and not in a second copy beside Rod.
- **What else changes:** Inflate, Extrude and Solid read the same `timedNow`, which the probe measured with no pace, so on the stage they played a performed row linear too. The ANIM-2B note said they honoured it; in the viewport they did not (read from the code, not filmed). With no performance row 8 still matches main, rod 9/9 and inflate 9/9. `assert-perform`'s dwell row reads Rod only.
- **The row stays OPEN until he watches it.** His localhost steps are in the ANIM-2B note below.

### F118 ANIM-2B note, 2026-09-25: NOT MERGE-READY. Rod plays a performed stroke linear; three regression gates not run.

Branch `lane/perform` in `~/.fs-lanes/perform`, rebased on main 633f110f9, head c75b247ab. `assert-perform.mjs` is 11 of 12 against this tree; its base (`docs/verification/perform/base-main.json`) was recorded on main's own code, with no Perform button on the page.

- **Blocks it, found by row 1b:** Rod's own clock under a timed take (`components/viewport-3d.tsx` ~6331, ANIM-1A5) reads `eases[i]` only. A performed stroke has `eases[i] = null`, so Rod draws it linear: a 1 s dwell held stroke 6 still for 29 ms. Inflate, Extrude and Solid read `sampleTake`, which honours the pace. Not my file. The fix, unverified: import `performedPenMs` from `lib/stroke-timing.ts` (committed here), set `const pf = timedNow.performed[i]`, add `&& !pf` to the identity test, and in the inside-slot branch use `pf ? performedPenMs(timedNow, i, u) : B0 + (B1 - B0) * (e ? e(u) : u)`. Then rerun `assert-perform` row 1b.
- **Not run:** `assert-stroke-strip` 18/18, `assert-take-timeline` 21/21, `assert-stroke-timing-browser --grade-solid` 38/38. The lane hit its context line first.
- **Fixed here:** the stage was a 90% veil with the page ghosting through (now opaque); every unstarted stroke drew a dot (a zero-length round dash); the slider was browser blue; the keydown listener and frame loop re-subscribed every tick, about 60 a second each while recording (now 0, row R2); the pace sampled at 20 ms, so a pause could play 40 ms short (now 5 ms, and a move that ends a hold pins the hold to the event).
- **Capture speed, per the Motion Sketch ruling:** at 0.5x he performed for 1973.7 ms and the take plays it in 991.3 ms; at 1x, 1973.4 ms plays in 1982.6 ms (row 5).
- **His localhost steps, once the Rod fix lands:** open `/`, pick stroke 6 (the D) on the strip, press Perform, drag along the lit D, hold still halfway for a second, finish, press Enter. Play: the D stops halfway for a second. Press Cmd+Z once: the take is back as it was. Open Perform again and press Esc halfway: nothing changes.

### F118 INSTR-3 note, 2026-09-25: MERGE-READY. film-loop's seam measure reads the drawing only, and `--glb=1` proves each pull's wrap state from the geometry.
Branch `lane/instr` off `d92d5a5eb`. One file changed, `scripts/verify/travel-wrap/film-loop.mjs`; arms in `docs/verification/instruments/film-loop/` (trace.json, seam PNGs, clean, full, `mask.png`, film.mp4, log; the 1.4 GB of raw frames were not kept). tsc 6 errors, baseline 6. `--selftest` 30 of 30. Dev server :3139, killed by pid.

- **The take panel is masked, from the DOM.** The box is the card that holds `[data-take-timeline]` and must also hold the Play/Pause button, or the run refuses. It is read before the clean frame and again after the film (the union is masked if it moved; it did not move in any of the 6 films), padded 2 px, and applied to clean, full word and every frame. A missing panel, a mask of 0 px or a mask over half the crop is an error, never an empty mask. The mask covers 23.3% (rod) and 24.4% (inflate, solid) of the crop; `mask.png` shows it in red, and the whole word sits above it.
- **Shares are full precision.** Share, ink px, share jump and both medians are no longer rounded.
- **A second fault, found on the masked measure: the median in-pass step is 0 on Solid.** With the panel out, 50.3% of Solid's in-pass pairs change 0 px (rod 42%, inflate 3%), so the median over all pairs is 0 and no ratio exists. The panel's moving playhead was what kept that median above 0. Before-rod and before-solid also read 0. The reference is now the **median step among pairs where the drawing changed**; the all-pairs median stays in the trace. A film must change on at least a quarter of its in-pass pairs, or it fails as barely moving.
- **K re-derived, still 30.** Masked, seam jump over the median changed step:
  - after, HEAD `d92d5a5eb`: inflate 2.2, 2.5, 1.8x · rod 8.0, 8.0, 8.5x · solid 8.0, 1.3, 12.4x. All 3 PASS.
  - before, the tree the recorded before films were made on (`5050d7ea6` for the 7 lib and component files, `lib/stroke-schedule.ts` from `bc9ae5c7b`): rod 169.6, 169.0, 169.6x · solid 343.2, 341.7, 344.1x · inflate 1069.7, 1069.4, 1069.7x. All 3 FAIL, every seam. The drawing jumps from 13% to 49% of the word (rod), 6% to 51% (inflate), 18% to 65% (solid).
  - K 30 sits 2.4 times over the largest after seam and 5.6 times under the smallest before seam.
- **The brief's positive-control recipe does not build on HEAD.** `git checkout bc9ae5c7b -- lib/stroke-schedule.ts` alone leaves `effectiveWindow`, `restPlayheadFor` and `windowParts` missing, because the viewport imports them since TRAVEL-4 to 6, and the harness never appears (180 s timeout, all 3 engines). The before arm above is how `5050d7ea6` filmed it. All 7 files were restored with `git checkout HEAD`, and `git status` on components and lib is clean.
- **`--glb=1` pulls two states it can prove.** three.js hands every Scene to `__THREE_DEVTOOLS__` (an init script), and the pull reads every indexed mesh for the doubled index (even count, both halves the same list, draw range past the half). It plays, pauses inside p 0.08 to 0.2 on the second pass for the wrapped pull, and inside 0.45 to 0.6 for the unwrapped one, same Travel window, and reads the wrap state and the playhead before and after the export. On rod: wrapped p 0.0836, 1 mesh doubled before and after the export (of 51, then 63: each export adds its own scene); unwrapped p 0.4540, 0 of 63 and 0 of 75 doubled; the playhead did not move during either pull; both GLBs 29792 triangles, and live stats 29792. PASS. The old "unwrapped" pull (grow, p set to 1, read back as 0.00104) now fails for having no wrap state read.
- **Must-fails in `--selftest`, all fire:** the wrapped pull's triangles doubled (59584 vs 29792), one short, a "wrapped" pull with no doubled index, an "unwrapped" pull with one, a playhead that moved, no unwrapped pull, the old recorded glb-rod. Seams: the 3 before arms, the 3 old unmasked after traces, a frozen film, a film changing on a tenth of its pairs, no seam, no mask.
- **Seen, not judged:** solid seam 3, the largest after seam (12.4x, 18.1% to 20.5%), is seven thin cut pieces appearing along the baseline in one frame. It passes K. Whether that reads as a pop is his call.
### F118 ANIM-1B note, 2026-09-25: NOT MERGE-READY. The strip is built and compiles; nothing has been run in a browser, and the gate is not written.
Branch `lane/anim1b` off main `3a211a36d`, commit `3fc86f18f`. The lane stopped at the context line before it started a dev server. tsc 6 errors, baseline 6.

- **Built, unrun.** `components/stroke-strip.tsx`: one rounded bar per stroke, laid out by `buildTimedSchedule` with the viewport's pace and `penMsOf(rawStrokes)` as `baseMs`. Drag the body for `delayMs`, either end for `speed` with the other end held, click to select, Hold back, Ripple (R when the strip has focus), arrows nudge 10 ms and Shift 100 ms, Up and Down change stroke, Esc lets go. The axis freezes for a drag. A click writes nothing.
- **Wiring.** `app/page.tsx` wraps the page in `StrokeTakeProvider` (take, `commitTake(next, key)` through `edit()`, mode, pen ms, stroke count). The window gesture bracket now also opens on `[data-stroke-drag]`, so one drag is one undo step. `take-timeline.tsx` renders the strip when a provider exists and the old view otherwise, so no other host changes. `viewport-3d.tsx` untouched.
- **Both doors.** `draw-in-timing-controls.tsx` gains the selected stroke's block: delay (ms), speed (x), the four eases, Hold back, Reset. It shows the Extrude and Solid line: "Stroke timing does not reach Extrude yet. Rod and Inflate play it."
- **What blocks it.** (1) `scripts/verify/assert-stroke-strip.mjs` does not exist: none of the six rows or their must-fails. (2) No screenshot, nobody has looked at it. (3) Not measured: strip slots against `__fsTake.get().slots`, whether a drag moves the picture on Rod and Inflate, whether the Timing popover's context reaches the block. (4) On `/` the strip has one row per stroke even in group mode, so `assert-take-timeline.mjs` may go red on group rows. Run it.

### F118 ANIM-1B2 note, 2026-09-25: NOT MERGE-READY. The strip passes its own gate 18/18, but `assert-take-timeline` crashes on it, and the three baselines were not run.
Branch `lane/anim1b`, commits `0b927b1d5` (strip look fix), `e8a3f6e26` (gate). tsc 6 errors, baseline 6. Stopped at the 150k lane context hook.

- **What I saw at 1512x982.** Twelve bars, one per row, top row is stroke 1. You tell strokes apart by row order only; the header names the selected one ("Stroke 6, on time, 1x"). The selected bar was NOT clear when the playhead had not reached it: its grey (foreground 55%) matched a finished bar's grey, and only two 2x4 px grips told it apart. Fixed: the selected bar now carries a 1 px inset outline over a light fill, and the grips are 2x6 px with `mix-blend-difference`, white on drawn ink and dark on the undrawn part. The strip uses the app's own pills, type and greys, and reads as part of the dock. Grabs: `docs/verification/stroke-strip/look-strip-sel9-2x.png` (stroke 10 selected, not yet drawn), `look-strip-sel5-1x.png`.
- **`assert-stroke-strip.mjs`, 18 PASS 0 FAIL** (`docs/verification/stroke-strip/run-lane.log`). Every row has a control that fires: strip slots equal `get().slots` to 0.000 ms and 1 px; a 60 px body drag writes delay 1115 against 1114.7 wanted, and the picture changes inside the shift on Rod (drawRange 3072 to 0) and Inflate, with knockout delay giving back the no-drag frame; end and start drags set speed 0.704 and 0.760 and the other end holds within 1 px; Ripple on moves all 8 later strokes 743 ms, off moves none; one 24-move drag is one undo step "Stroke timing", undo restores the rows exactly; the Extrude and Solid notice shows; the Animation tab sets delay 250 (slot moves 250.0 ms) and the Timing popover shows 250 and sets speed 2 (slot halves). No drag: take, durations and 18 canvas frames byte-identical to main `3a211a36d` (`base-3a211a36d.json`). That row compares canvas and take readout, not the strip's DOM, which differs from main by design.
- **What blocks it.** (1) `assert-take-timeline` is 20/20 on main in this session and CRASHES on the lane after A1: its `strip()` reads `[role=img]`, and the new strip's band is `role=listbox`. The gate is wrong for `/`, not the strip: the band is a control now, and the gate's F1 ("nothing under the strip is a control") and F2 ("clicking a bar changes nothing") test the view the ruling voided. It needs its `/` rows re-pointed at the ruled behaviour, or its reader told apart by `data-stroke-strip`; that file is not this lane's. (2) Not run: `assert-drawin-timing` 25/25, `assert-export-window` 39/39, `assert-stroke-timing-browser` 20/20.
- **To try it on localhost.** Start `/`, draw a word with four or more strokes, press play once so the strip fills. Click a bar: it gets an outline and the header names it. Drag its middle right: it starts later, and the drawing shows it later. Drag its right end: it draws slower. Turn on Ripple and drag again: every later bar slides with it. Press Cmd+Z once: the whole drag goes back. Switch to Extrude: the strip says timing does not reach it.

### F118 ANIM-1B3 note, 2026-09-25: MERGE-READY. Every gate the brief named is green on `lane/anim1b`, and `assert-take-timeline` now tests the strip the ruling made.
Branch `lane/anim1b`, commit `177ac999e` (gate) on top of `4a8f90825`. tsc 6 errors, baseline 6. His eye on the strip is still the open call.

- **Counts on this head, :3138, headless.** `assert-take-timeline` 21/21, 0 vacuous (20/20 on main before; the lane adds F3). `assert-drawin-timing` 25/25. `assert-export-window` 39/39. `assert-stroke-timing-browser` 20/20, Rod and Inflate graded, Extrude and Solid NOT WIRED by its own statement. `assert-stroke-strip` 18/18. The same updated gate on main 3a211a36d, which still renders the read-only view on `/`: 20/20, F1 and F2 unchanged and passing.
- **Rows whose meaning changed, and why.** The ruling, `docs/rulings/2026-09-25-animation-comes-back.md` (*"we're bringing basically everything back"*), made the timeline on `/` a strip he drags, and the gate's header now cites it.
  - **The reader.** It reads the `listbox` band when the root carries `data-stroke-strip` and the `img` band otherwise, and throws on a root with neither. The throw is deliberate: an empty result would have read as an empty strip. It also sums every ink segment on a bar, because a strip bar can carry more than one; the view has one per bar, so its numbers are identical.
  - **F1 on `/`.** Inverted, from "nothing is a control" to "the strip IS a control". 5 of 5 bars are an option in a focusable listbox, the pointer lands on each bar at its centre, the cursor is grab, and both ends are ew-resize. Must-fail: the same probe on the 3 axis ticks, which scores 0 of 3.
  - **F2 on `/`.** Now "a click selects and writes nothing". Selection went from none to stroke 3, and the take was unchanged. The reader now reads `__fsTake.get().take` as well as the draw-in. The old reader read only the draw-in, and on the lane the old F2 PASSED on `/` without being able to see a write to the take. Must-fail: the same reader after a real drag has to see the change. Shown firing: with the old reader swapped back in, F2 and F3 both fail.
  - **F3, new.** A drag on a bar writes. 80 px was about 247 ms under the pointer; stroke 3's delay became 246 ms and its start moved 246 ms. Must-fail: the same drag over the strip's title writes nothing.
  - **C4 on the strip.** The view's question, "fused ink collapses into fewer rows", cannot apply, because the strip keeps one row per stroke. On the first run it printed VACUOUS with the reason "ink never fused", which was false. It is now asked at overlap 0.8, where Scene applies the grouping (at `asDrawn` + overlap 0 it skips it): 3 units from 5 strokes, one bar per stroke kept, 10 of 10 ordered pairs match the grouped model, and 4 of 5 bars moved away from their `Strokes` position. Must-fail: a rotated model, as in B2.
  - **Unchanged, not loosened.** A1 to A6, B1 (1.5 px), B2, C1 to C3, D1 to D3, E1, E2 (50 rAF/s) and G1. On a host that renders the read-only view, F1 and F2 run word for word. No host renders that view today: `/` provides the take, and `/desk-doodles` is chromeless, so it mounts no strip. §G prints that on every run.
  - **Housekeeping.** The gate used to delete its whole evidence folder on a run without `--keep`. It now deletes only the pngs that run wrote, so the committed logs survive.
- **To try it on localhost.** Run `cd ~/.fs-lanes/anim1 && npm run dev -- -p 3138`, open `localhost:3138`, draw four or more strokes, and press play once. Click a bar: it gets an outline, the header names it, and nothing else moves. Drag its middle right: the header reads `+N ms`, and the drawing starts that stroke later. Drag an end: that stroke draws slower. Press Cmd+Z once: the drag goes back. The gate: `FS_PORT=3138 node scripts/verify/assert-take-timeline.mjs`.

### F118 INSTRUMENTS note, 2026-09-25: MERGE-READY for the Node arms. The browser arms are written and NOT RUN.
Branch `lane/instr` off `466d1e7bd`, 4 commits: `2bbe1ab92` closed-loops, `cc0ecd14b` solid-bench, `6c11df041` travel-wrap, `cdb456a18` pen tools. Spec: Codex's crosscheck of 11 instruments that could stay green on a broken result. Stroke timing was already closed on main; the memory probe belongs to another lane and was not touched. tsc 6 errors, baseline 6.

- **closed-loops, row D.** It claimed every open stroke is byte-identical and compared only the endpoint gap. `openStrokeDiff` now checks point count and every x and y with `===`, and refuses a non-finite value, so a NaN gap fails. The row also fails if it compared 0 strokes. `--selftest` adds 8 cases on real open stroke #1 (80 points): 2 must-pass, 6 must-fail, including an interior point moved 99 units with the endpoints held. 14 of 14 hold. With the old gap-only comparison swapped back in, 4 of them go red and the selftest exits 1. `--offline` still exits 0.
- **solid-bench `bench.mjs`.** The signature now covers the mesh fields, every attribute, the index buffer, groups, draw range and morph attributes. A mesh with no geometry is hashed as a marker, not skipped. `--selftest` on a real hero frame: winding reversed, normal flipped, position removed and a field changed all differ, and an untouched clone matches, 5 of 5. With the index fold removed, the winding case goes red and the selftest exits 1. Two clean runs give identical signatures on 120 of 120 frames. The format changed, so any `--sigs` file saved before `cc0ecd14b` differs on every frame. Re-take the before file.
- **`make-mutant.mjs`** now runs bench clean and then mutant, and exits 1 unless the control changes a signature. It exits 2 if a bench run fails. canvas-edge-only and pad0 each change 120 of 120. The new `--control=noop-must-fail` swaps the anchor for itself and exits 1.
- **`crossholes.mjs`** exits 1 unless X0 to X3 all hold: owners published, head holes present, Doodles uses its own, Desk ignores Doodles', and word = Desk + Doodles. On HEAD 4 of 4 hold. For the must-fail, put the owner filter back to every-cluster-gets-every-hole: `node -e '<anchor "holeStabilization.activeFinalHolesWorld.filter((_, hi) => holeOwners[hi] === gi)" to "holeStabilization.activeFinalHolesWorld">' > m.json; GATE_MUTATE_FILE=m.json node scripts/verify/solid-bench/crossholes.mjs`. X2 then reads 2688 vertices, PLAN.md's own number, X3 reads 6256, and it exits 1.
- **travel-wrap `film-loop.mjs`.** The seam check fails when the share jump is more than K = 30 times the median in-pass step. K comes from the recorded arms in `docs/verification/travel/*/trace.json`. After arms read 2.0 to 23.8x, the largest being film-after-solid seam 3. Before arms read 276.7 to 828.0x. pop-t6-solid and opening-t6-solid read 3.5 to 13.5x. **K 30 turns opening-t6-rod seam 3 red (54.5x)**, the drop LOG.md lists as "not investigated". `--stills` compares its controls: the repeat must differ by 0 px and the step by more than 0. `--glb` compares the two triangle counts. `--compare` checks both directions. `--selftest` runs in Node on the recorded data, 20 of 20: all 3 before films fail, all 3 after films pass, and a frozen film or one with no seam fails. The stills controls pass at 0 px, and at 441, 606 and 3460 px for the step, and fail when swapped. The GLB check fails one triangle short. The set check fails with one extra still on either side. `--compare` also ran on real directories: stills-before-rod against stills-after-rod gives 16 of 16 identical and exit 0. A copy with one extra still in B exits 1.
- **`wrap-proto.mjs` W6.** The window must cover the whole beat (1.0), change on every frame (0 still frames of 373) and travel at least 1.9 per pass (it measures 2). A window frozen at wrapped d 0.05 passes W2 and W3 (seam 0 against median 0) but fails W6 at L 0.25 and 0.75 (covered 0.25 and 0.75, 373 still frames, travelled 0). The run still exits 0 with every must-fail firing.
- **Pen tools.**
  - `edge-soft`: a missing, empty, non-numeric or out-of-range `--min`, or a bad box, is refused with exit 2. Below `--min` exits 1. At 0.8, pen7-base 0.84 and pen8-j32 0.85 pass, and pen7-after2 0.54 exits 1.
  - `slit-count --max`: above it exits 1. `-1`, `abc` and a run with no png are refused with exit 2. At `--max=0`, pen8-j32 reads 0 and 0 and passes. pen7-base 2.501 paired with its hold reads 21 px, not the table's 14, maybe because no box was set, and exits 1. Without `--max` it still only measures, and now says so.
  - `tip-end`: fails a mode that scores 0 triples or skips more than `--max-skip`, default 0.6. The recorded base and after arms skip 0.44 to 0.59 of their triples. `--selftest` passes 31 of 31 on the 29 recorded modes, with pen4-taper5 (0.63) and pen4-taper8 (0.81) red as expected, plus an all-skipped real `summarize` and a missing summary. The reed arm is one skip from red: 16 of 27 skipped, and 17 is 0.63.
- **NOT RUN, they need a browser (none was open this lane):** `node scripts/verify/assert-closed-loops.mjs` (rows A to D live; row D is now exact `===`, so a float difference between the page and Node would show red on the first run, and that would be a finding, not noise); `FS_PORT=3137 node scripts/verify/travel-wrap/film-loop.mjs <out> --engine=rod|inflate|solid`, plus `--stills=1` and `--glb=1`; `FS_PORT=3130 FS_HEADED=0 node docs/verification/pen/tools/tip-end.mjs <label>`.
- **Seen, outside these files, not fixed:** `scripts/verify/_ts-load.mjs` reads `GATE_MUTATE_FILE` as `f && existsSync(f) ? ... : {}`, so a mistyped mutant path runs **unmutated** and says nothing. make-mutant passes a path it just wrote, so it is safe; a hand-typed path is not. In `glb-rod/trace.json` the "unwrapped" pull reads p 0.001, not 1, and its count still equals the mid-wrap one. Not investigated.

### F118 TRAVEL-8 note, 2026-09-25: MERGE-READY. No new red row on HEAD 2b1926391.

MERGE-READY. The eight gates TRAVEL-7 did not reach ran on HEAD against `gates-before/`, and every
red row on HEAD was red on the base, with the same numbers. `assert-stroke-schedule` is 57 pass and
3 fail on both, the same 3 rows. `assert-drawin-pentip` fails 1 of 43 on both, the same
free-stroke-off DECISIVE row (margin 0.1745 w vs IQR 0.1992 w). `assert-drawin-timing` ran twice and
passed 25 of 25 both times, CONTROL rows included. `assert-take-persists` 45 of 45,
`assert-export-plan` 12 of 12, `assert-timing-frames` 30 of 30 on the fresh travel-after frames.
`_probe-pentip-sweep` and `verify-timing-origin` capture and do not grade: both exit 0, the probe
output matches the base except its path, and timing-origin wrote 196 frames with 0 console errors.
With TRAVEL-7's two (`assert-take-timeline` 20 of 20, `assert-export-window` 39 of 39) all 16
run-all steps have now run on HEAD. Table in docs/verification/travel/gates-after/compare-gates.txt.

The commits to merge, `git log --oneline bc9ae5c7b..HEAD`, 12:

    2b1926391 F118 TRAVEL-7: seamless Travel memory scenario (doubled index freed), after films and stills, 8 of 16 run-all steps, Rod seam 3 is the take panel
    b72c3e551 F118 TRAVEL-6: log and run-queue note
    82c05a3de F118 TRAVEL-6: a Solid cut piece builds from its first pixel, and the cluster test uses a cut piece's true radius
    62777e873 F118 TRAVEL-5: log and run-queue note
    7bb63aace F118 TRAVEL-5: opening flag starts true and lives in Viewport3D; seamless window reaches harness, rest playhead, export ends and the take timeline; a wrapped geometry frees its second index on dispose
    76cb15aca F118 TRAVEL-4: log and run-queue note
    6ac670808 F118 TRAVEL-4: the stats readers read originalIndex, and film-loop --glb=1 checks a mid-wrap GLB
    00aad3a9e F118 TRAVEL-4: a Solid cut piece shorter than the line width is stroked at its own arc
    f292ceb15 F118 TRAVEL-3: doubled-index wrap on Rod and Inflate, pen tip joins by max, opening-pass ref, after films and stills (Solid seam not held, piece minimum)
    a4465d637 F118 TRAVEL: before arm filmed on bc9ae5c7b lib (Rod, Inflate, Solid, 3 seams), stills mode, gates before
    e6d22779d F118 TRAVEL: loop film case and gate runner, lane log with what is left
    841ca9f4c F118 TRAVEL: two-part window in the lib (wrapLo, windowParts, effectiveWindow), checked in Node

Merging does not close F118. The row stays open until he has watched the films and says it looks right.

### F118 TRAVEL-7 note, 2026-09-25: NOT MERGE-READY. 8 of 16 run-all steps ran, then the context gate.

Blocks merge: the gates from `assert-drawin-timing` on did not run, so the two red gates on the base
(`assert-stroke-schedule` 3 rows, `assert-drawin-pentip` 1 of 43) are unchecked. Done: the memory
probe has a seamless Travel scenario, and on HEAD the doubled index is freed (2 uploaded, 2 deleted
in 60 s; the no-hook arm deletes 0 of 2). Films: seam jumps Rod 0.0046, Inflate 0.0031, Solid 0.0095
at most. Stills: Rod and Inflate 16 of 16 identical, Solid 10 of 16, the 6 changed are one-pixel rims
on cut pieces from TRAVEL-6's cluster change. Rod seam 3's drop is the take panel updating 5 frames
after the wrap, not the scene. Found outside F118: each Rod rebuild leaves 12 geometries and 48 GL
buffers, the same before any wrap code. Details in docs/verification/travel/LOG.md, TRAVEL-7.

### F118 TRAVEL-6 note, 2026-09-25: NOT MERGE-READY. Steps 1 and 2 filmed, 3 to 5 not run.

Blocks merge: the memory probe has no seamless Travel scenario yet, and `run-all.sh after` has not
run on this code. The lane stopped at the context gate. On lane/travel: the opening now films empty
(Solid and Rod, 0 scene px on frames 0 to 4). The Solid in-pass pop came from two things: the
`outerAreaAbs < 10` gate in solid-mask.ts dropping short cut pieces, and the cluster test using
the full line width for a cut piece that TRAVEL-4 strokes narrower. Both changed. Film: in-pass max
0.0150 (before arm 0.0134, TRAVEL-3 0.0918), seam jumps 0.0053 / 0.0014 / 0.0054. Details and next
step in docs/verification/travel/LOG.md, TRAVEL-6.

### F118 TRAVEL-5 note, 2026-09-25: code in, not filmed. Still OPEN.

Commit 7bb63aace on lane/travel: the opening flag starts true (the rest frame at 0 showed the
wrapped tail), and the seamless window now reaches the harness, the rest playhead, the export ends
and the take timeline. A wrapped geometry frees both index buffers on dispose. Nothing measured:
no film, no gates, no memory probe. The Solid rod pop is not started. Details and next step in
docs/verification/travel/LOG.md, TRAVEL-5.

### F118 step 2 note, 2026-09-24 late: the turn and its white ghosts, MEASURED, no code changed yet

The lane stopped at the 150k context line after measuring. No file under lib/ or components/ was
edited. Evidence: `docs/verification/hero-beat-film/f118-turn-before/` (fresh film of the tree as
it stands) and `docs/verification/hero-beat-film/f118-turn-probe/` (probe script, model table,
override screenshots, `arms-contact.png`).

**The mechanism, in plain words.**
- **There is no per-letter turn on this film.** The shipped film is `shape: "shipped"`.
  `sampleLetters` returns `undefined` on it, and `letterPivots()` reads `null` on the live page at
  every return frame probed (6 playheads, 11.45 to 11.70 s). The code at
  `lib/hero-motion.ts:2454-2497` belongs to the `letterByLetter` film only. The whole word is one
  group turned by one matrix about one pivot (`components/viewport-3d.tsx` ~6320-6345). The edge
  sliver at 11.52 s is a single sliver, which a per-letter turn could not make.
- **The pile-up is depth, not pivots.** `sampleReturn` turns the lit solid from 0 to 90 degrees
  in 11 frames at FULL depth (1.0). The strokes are round tubes, so a vertical stem does not get
  thinner as the word turns, while the spacing between letters shrinks by cos(yaw). At 58 degrees
  the word is 53 % wide with every stem still full width, at 75 degrees it is 26 %, and at 90 all
  eleven letters stack into one sliver. That reads as each letter turning on its own axis and
  piling into its neighbour.
- **The white ghosts are the pen carve on a thick body.** At the edge (u = 0.5) `flat` flips to 1,
  `penCarve` jumps 0 to 0.7 and `jointBreak` 0 to 1 in one frame, but `depth` only starts to leave
  after the edge, on `easeInOutCubic`: 0.996 at 66 degrees, 0.978 at 50, 0.934 at 37 (see
  `model-return.txt`). So for about 4 frames a full-depth tube, turned 35 to 85 degrees, is painted
  as flat ink with the carve cutting it back to the pen outline. OFAT on the live page
  (`arms-contact.png`, 4 playheads by 4 arms): `penCarve: 0` removes every ghost; `jointBreak: 0`
  alone removes none. The ghosts are the carve. With the carve off, the same frames are a smeared
  bold black slab, the depth again.
- **The same schedule sits in the emerge.** `sampleEmerge` brings depth in across the turn-out
  while the ink is still flat and carved (0.64 at 15 degrees, 0.90 at 32). That is the likely cause
  of the white sliver in the "l" at emerge 640. Not changed, not probed.

**The comment that is wrong.** `sampleReturn`'s doc says depth "DEPARTS after the edge ... head-on,
a tube seen down its own axis has the same outline whether it is 1mm or 10mm thick". True at yaw
0 only. The departure runs at 66 to 12 degrees, where depth shows at sin(yaw) of full thickness.

**Next step, exact.** In `sampleReturn` (`lib/hero-motion.ts`, the `turnPhase` branch), make depth
leave during the turn-OUT as the lit solid turns, as a function of yaw, e.g.
`depth = flatDepth + (1 - flatDepth) * cos(yaw)^2`, and hold `flatDepth` through the dwell and the
whole way back. Then the solid thins as it turns (no stacking), the edge is the empty frame §10.2
C7 already names, and the way back is a flat carved card squeezing in x, which is the resting
picture turned, so the carve has nothing thick to cut. Update the doc comment. Check first whether
`assert-hero-return` holds "the sliver is full thickness on both turns" as a row; it will go red
on purpose, report it, never edit it. No locked ruling found in `docs/rulings/` or storyboard
§11.9 onward that fixes the return's depth schedule. Then film `--label=f118-turn-after`, contact
1052-1137 before over after, and run the four gates again. Before-gate logs were being captured
when the lane stopped; see the hand-back for which finished.

**Still OPEN.** Nothing here changed the picture.

**2026-09-24 late, step 1 (the eye), partial. 1 of 4 checks built; the lane stopped at 150k.**
- Built `scripts/verify/assert-eye-white-in-ink.mjs`. Output: `docs/verification/eye-checks-2026-09-24/white-in-ink/`.
  RED on today's film, exit 1, 469 of 1300 frames. At the named frames: 1250 B 164 px (bar 6);
  1130 A excess 61 (bar 17); 1115 G 439 hairline px (bar 6); 640 A excess 123 (bar 24).
  Must-pass: synthetic clean word reads 0, 29 planted px read 29; breath frames read 0 on all three.
  The hold crop marks the Desk "e" nick, the Doodles "D" foot bar and the Doodles "e" nick, nothing else.
- Found by looking: the 1115 "white ghosts" are grey hairlines tracing a second copy of each letter's
  edge 2 to 6 px off the stroke. 640's sliver is the page grid line showing through the "l" (lum 144 in ink 20).
- Unread: G also goes red through tilt, standup and orbit. Nobody has looked at whether that is ghosting
  or the solid's shaded side. Open `worst-standup-0893-G.png` first.
- Reference: no film dated 07-31 or 08-01 exists. Candidates, unopened, in `docs/verification/eye-reference/README.md`.
- **Next, exactly:** build `assert-eye-letter-overlap.mjs` (ink width over rest width during returnTurn;
  1100 is the named frame, at 0.48 width), then `assert-eye-draw-reads-written.mjs` (per-frame new-ink
  mask on draw 0-462) and `assert-eye-s-shape.mjs`. Reuse `loadFilm`, `gray` and `cropInk`, exported from the
  white-in-ink script (its phase mapping matches the brief's table 12 of 12). Each one must go RED on this film first.

**2026-09-24 late, step 1 (the eye), second lane. Check 2 of 4 built; check 3 unfinished; check 4 not started. Stopped at 150k.**
- Built `scripts/verify/assert-eye-letter-overlap.mjs`. Output: `docs/verification/eye-checks-2026-09-24/letter-overlap/`.
  RED on today's film, exit 1, 33 of 208 turn frames (anticipation, emerge, returnTurn). Each frame is read against the flat
  ink resized to its own ink box (a thin card at that width): M ink mass, S mean stem run, P ink per occupied column. RED needs
  over the bar against the flat card AND against the resting solid (784) squeezed the same way.
  At 1100 (w 0.48): M 1.66, S 2.43 (stem 23.7 px vs card 9.8), P 1.59, bars 1.10; vs the solid card 1.43 / 1.92 / 1.41.
  At 1105 (w 0.03, 17 px): M 3.69, S 4.53, P 3.69, bars 1.61 / 1.10 / 1.67. Emerge 650 and 660 read the same as 1105 and 1100.
  The flat half of each turn reads clean (1112-1138, 630-648), the solid half red, which matches the step 2 model.
- Bars: 1 + 1.5 x worst clean excess, floor 0.10, from 39 thin-card poses (area-splat renderer, cos 1 to 0.03, 3 perspectives).
  39 held-out poses at height 0.97 read clean against those bars (0 of 39 red). Must-fail round tube: red at every cos <= 0.7.
  The held-out poses caught a real flaw on the first run: a median stem run steps 25 % per px at 0.3 width. Changed to the mean
  before the film was run.
- Opened `film-over-card-1100.png`: fat tubes; "oo" fused into one dark mass, "es" fused, the k crowding the e; the card under
  it has every letter thin and every counter open. `film-over-card-1105.png`: a 17 px black outline, white inside (the carve),
  where a thin card is a faint scribble.
- Cannot see: pitch and orbit turns (tilt, standup, orbit, descend are printed as info only); letters colliding at full width.
- `scripts/verify/assert-eye-draw-reads-written.mjs` is committed UNFINISHED. Its selftest FAILS: the clean stroke reads clean
  and the planted pop is caught, but the planted freeze, jump and two-places are missed. Cause found: the new-ink mask drops
  growth within 1 px of old ink, and the synthetic runs at the film's measured median speed, 71 px/s, under 1 px per 10 ms frame,
  so the clean stroke itself splits into 3 pen-downs with 300 ms gaps and the freeze bar comes out 450 ms. The film's own raw new
  ink is 36 px per frame median (about 2.6 stroke widths of 14 px), so the speed estimate is wrong, not the film.
- **Next, exactly:** in the draw check, measure advance from the RAW new ink (ink and not ink before), keep the 1 px dilation only
  to decide which pieces are real, and recompute the film's median speed; rerun `--selftest` until all five cases read right,
  then run the film. Then build `assert-eye-s-shape.mjs`: locate the "s" and "." as the last pen-downs of the draw check (their
  new-ink masks separate them even where they are fused at rest), measure contour turning angle on the s over half a stroke width
  of arc, and the gap between the two masks against one stroke width; must-pass a synthetic smooth s with a separate dot at the
  film's s size. No reading from the draw check exists yet: pen-lift durations and stroke order are NOT reported.

### F118 step 2 note, 2026-09-24 late: the turn CHANGED, here is the film. Still OPEN.

**What changed (`lib/hero-motion.ts` only).** A new `solidDepthAt(yaw)` (~2436): the lit solid's depth is
`flatDepth + (1 - flatDepth) * cos(yaw)^2`, normalised to the landing yaw. `sampleReturn` (~3019-3038): depth
leaves on the turn-out by that law, and the dwell and the whole way back hold `flatDepth`. `sampleEmerge`
(~2880-2911): the mirror. The drawing half and the dwell stay at `flatDepth`, and depth arrives on the turn-in.
Both doc comments are rewritten; the old "same outline at any thickness" line was only true at yaw 0.

**The other phases are byte-identical.** Every frame at 30 fps, for all 7 shapes, before and after
(`f118-turn-after/model-byte-identity.txt`). Only emerge and returnTurn frames differ, on shipped and
turnLands. solidFirst differs only in returnTurn. popUp, standTurn, cutaway and letterByLetter show 0 differences.

**Film:** `f118-turn-after/`. It is fresh code: draw frames differ by 0.00 mean, turn frames by up to 1.91.
Sheets: `contact-return-before-over-after.png`, `contact-emerge-before-over-after.png`, `zoom-*.png`.
Real-time side-by-side: `turn-before-after.mp4` (1.37 s).

**What I saw.** On the return turn-out the letters are thinner and stay separate. Before, at 11.52 to 11.55 the
"oo" and "les." became one dark mass; after, "Doodles" still reads at 50 % width. It is still a squeezed
word, not per-letter. The white ghosts are gone. Before, 11.68 to 11.72 had doubled grey outlines on D, e, D
and l; after, the ink is clean. The emerge ghosts at 639 to 646 are gone the same way.
**New and wrong:** the edge is now a BLANK page for about 3 painted frames on each turn, where before it was a
black sliver. The turn-in solid also reads lighter grey than the settled solid for a few frames.

**Gates that moved, none edited:**
- `assert-hero-return` "depth DEPARTS after the edge" went red. It asserts full depth before the edge, so
  it goes red by design.
- `assert-hero-turn` "the sliver is REAL THICKNESS" went red. Same reason, on the emerge.
- `assert-hero-transition` "the beat contains a MOMENT" and "the moment is a SLIVER, not a blank or a blink" went
  red. They catch the blank I saw. "ink never washes past the settled value" went red: core 40 against 33. That
  is the lighter turn-in solid. REGISTRATION went from red to green (cx step 2.5 to 1.5 px).
- Unchanged: `assert-letter-seam`, `assert-hero-windup`, `assert-hero-ledger`, `-options`, `-twos`.
- `assert-hero-carve` went red on PROVENANCE, which is expected after a lib edit. After a recapture of
  carve and carve-prior it is SOUND 12/12.
- Eye check white-in-ink: the returnTurn hairline count G went from a worst of 439 to 1, and the emerge G from
  443 to 1. Emerge A at width 0.88 stays red in both (163 before, 179 after). That red is the grid line through
  the "l", which this change does not touch. `assert-eye-letter-overlap.mjs` is uncommitted and was not run.

**Next, his call:** is the blank edge acceptable, or does the edge need a sliver back? One option is to hold
some depth at the edge on the SOLID side only, with the carve never on it. Then the lighter turn-in solid.

### F118 step 2 note, 2026-09-24 late, lane "after2": MEASURED ONLY, no code changed. Stopped at the 150k context line.

Nothing under lib/ or components/ was edited. No film was made. Evidence: `docs/verification/hero-beat-film/f118-turn-after2/`
(`probe-grid-layer.mjs`, `probe-grid-ofat.mjs`, `grid-probe/`).

**The blink, mechanism read from the model (not yet filmed).** The dwell is 2/30 s and pins yaw at exactly 90 deg. Since
c391840e both dwells hold `depth: flatDepth` (0.004), so the edge-on word is a 0.004-deep card: nothing to paint. The return's
dwell is also `flat: 1`, which puts the carve on it. Near the edge the angle moves about 22 deg per 30 fps frame
(`easeInOutCubic` slope 3 at u = 0.5, turn 0.83 s), so only the dwell and one frame each side are within 25 deg of the edge.
- **Plan for the fix.** A named edge depth on the SOLID only. `solidDepthAt` gets a near-edge term (for example
  `max(cos^2 law, edgeDepth * sin(yaw)^8)`, which is under the cos^2 law below about 50 deg, so the mid-turn stays thin).
  The emerge dwell (`flat: 0`) takes `edgeDepth`. The return dwell has to become the solid (`flat: 0`, `jointBreak: 0`,
  `edgeDepth`), with `flat` and `jointBreak` flipping on the first frame after the dwell, or the sliver sits under the carve.
- **Cost of that plan, read from the gates' code:** `assert-hero-return` "an object goes in and a DRAWING comes out, at the
  edge" and "the drawing comes back CHANGED, only at the edge" allow the flip within 1 frame of the first dwell frame. A flip
  after a 2-frame dwell is 2 frames off, so both would go red. This is his call or the controller's. The other way (keep the
  return's dwell flat and carved) breaks the brief's "never under the carve".
- The sliver the transition gate wants: extent under 5 % of settled (31 of 619 px), at least 2 px, 2 or more frames
  (`scripts/verify/lib/hero-moment.mjs`, `MOMENT_MAX`). A tube at depth d edge-on is about 2r*d wide, so edgeDepth 0.5 gives
  roughly 7 to 9 px.

**The lighter turn-in: not measured.** Candidate, unchecked: the z scale squashes the tube's normals toward the face normal, so
a thin lit solid shades as one plate. Measure the dark core per frame on the emerge turn-in before touching anything.

**The grid through the "l": the layer is the `gridHelper` (`components/viewport-3d.tsx` ~9268), at z = -0.05.**
- Measured in the film (`f118-turn-after` frame 673): the grid line at screen x 705 (through the "d" and "l") and x 830
  (through the "s") shows inside the ink at lum 152 against ink 47. The lines at x 328, 454 and 579 do NOT show through their
  letters (in-ink mean 47, 55, 47). So it is selective, not an overlay.
- Measured live (probe-grid-layer, headless): one ink mesh, MeshPhysicalMaterial, opaque, depthTest and depthWrite on. The grid is
  opaque, depthTest on, renderOrder 0. Flat ink sits at world z within 0.00014 of 0; the solid spans z -0.080 to +0.079. So the
  grid is 0.05 BEHIND the flat ink's front and cannot win a depth test on geometry alone.
- The camera is ORTHOGRAPHIC with **near -1000, far 1000** (zoom 250.95, position 0.42, 1.23, 3.59: tilted about 19 deg). That is
  a 2000-unit depth range for a 0.05 gap. At 24 bits that is still 400 steps; at 16 bits it is 1.5 steps, which is z-fighting and
  would be selective by screen position exactly as seen. Not proven.
- OFAT (probe-grid-ofat, headless, t 6.95): **the clean arm shows NO grid line through the ink**, the `front` arm (grid moved to
  z +0.2) shows it at the same place. So the defect did not reproduce headless, and the film is headed (`FS_HEADED=1`). A
  headed-only depth defect points at the depth buffer's precision on the headed GPU path. `grid-probe/t12.20-*.png` is unopened.

**Next, exactly.**
1. Run `probe-grid-ofat.mjs` with `FS_HEADED=1` at t 6.95 and 12.2. If the clean arm shows the line and `back` (z -0.5) and
   `hidden` do not, the cause is depth precision. The fix is then in the layer file `components/viewport-3d.tsx` (name it before
   editing): either tighten the ortho near/far to the scene (for example -20..20) or give the grid `depthWrite: false` with
   renderOrder -1, so the ink always paints over it. The second one leaves every other depth relation alone; prefer it.
2. Then the blink, by the plan above, after the controller rules on the return-dwell flip.
3. Then the lighter turn-in, measured first.
4. Byte identity with `f118-turn-after/dump.mjs` and `cmp.mjs`, film `--label=f118-turn-after2`, the 3-way sheets and mp4, the gates.

**Still OPEN.** Nothing here changed the picture.

**2026-09-24 late, step 1 (the eye), third lane. Check 3 of 4 finished; check 4 written, never run. Stopped at 150k.**
- `scripts/verify/assert-eye-draw-reads-written.mjs` is finished. Advance is read from the RAW new ink; the 1 px filter
  only decides which pieces count (at least 4 px, and past the 1 px band or at least half a stroke width of px). Tiny pieces
  touching the pen tip count as the pen still moving. Film pen speed is now 297 px/s (was 71), median raw new ink 37 px a frame.
- `--selftest` 9 of 9 right (`selftest.txt`): clean e at film speed and at 80 px/s set the bars (freeze 60 ms, pop 20.5 stroke
  widths in one frame); held out at 150 px/s, 594 px/s and a straight bar all clean; planted freeze, pop, jump and two-places
  each caught as their own kind only. Two changes made on the synthetics, before the film ran: ink resuming a stroke width away
  after a gap is a crossing of old ink, not a freeze; and the slow e joined the bar-setting set because at 80 px/s its natural
  gaps reach 40 ms.
- Today's film, draw 0-462: RED, exit 1. TWO 12, JUMP 4, POP 0, FREEZE 0. 14 pen-downs read, not 21: strokes that start within
  1.5 stroke widths of the last end with no time between read as one (the k's arm runs straight into the Doodles "D").
- Pen lifts from pixels: 13, playhead gap between inks 0 ms x1, 10 ms x10, 20 ms x1, 30 ms x1. **R1's fixed 60 ms is not what
  the pixels show**: the next stroke's ink starts 10 ms after the last one's, and at 7 of the 13 changes the new stroke starts
  while the old one is still inking (the TWO frames 141, 161, 245, 281, 318, 362, 381). Travel between strokes runs 2900 to
  9900 px/s against 297 px/s drawing. A 60 ms lift in the schedule could be hidden inside an ink reveal that lags the pen; the
  pixels cannot tell.
- Stroke order: left to right except the ending; 2 pen-downs go back left (both in "s."). See `pen-order.png`.
- Seen by eye, not judged by the check: both "e"s are drawn BACKWARDS, from the exit tail at bottom right, left along the
  bottom, round, and the crossbar last (`desk-e-strip-0059-0108.png`). The final "s" is not an s: a "<" (frames 421-440),
  then a slanted dash for the period (446), then a long bottom stroke that starts back under the "e" (450) and sweeps right
  into the dash, 200 px of ink in one frame at 456 (`ending-strip-0420-0572.png`). That is the zigzag fused with the period.
- `scripts/verify/assert-eye-s-shape.mjs` is WRITTEN, NEVER RUN. Method in its header: s and "." labelled by birth frame from
  the draw check's pen-downs, sharpest CONCAVE outline turn over half a stroke width (convex printed only, since a round cap and a
  round-joined corner both read about 57 degrees), gap in stroke widths. Controls: 18 clean smooth-s poses set the bars, 2 held out,
  zigzag must go red on TURN only, touching dot on GAP only.
- **Next, exactly:** run `node scripts/verify/assert-eye-s-shape.mjs docs/verification/hero-beat-film/2026-09-24-look --selftest`,
  fix it until the controls read right (the Moore trace start direction and the dot-placement loop are the untried parts),
  open `control-*.png`, then run it on the film and open `worst-turn-*.png` and `worst-gap-*.png`. Expect the "." to be found
  at about frame 452, where the dash is last separate. Remove the STATUS line at its top only when all that holds.

### F118 note, 2026-09-24 late: the traced strokes CHANGED, not yet filmed. Still OPEN.

**The source.** The live hero reads `scripts/capture/logo-strokes.json` through `app/desk-doodles/page.tsx`
`buildTracedStrokes` (line ~174), which drops strokes shorter than the nib (22.58) before timing them.
`capture-frames.mjs` and about 15 probes read the same file.

**Old trace, per letter (22 strokes, 9 under the nib).** D 1 + 2 stubs. Desk e 1, drawn BACKWARDS from the tail.
Desk s 1 + 1 stub, its top curl split off as stub #6 at the k stem. k stem + arm + 2 stubs. Doodles D 1 + 1 stub.
o 1, o 1. d 1, drawn stem-top first. l 1. e 1 + 1 stub, BACKWARDS. Final s: #18 (top, into a "<"), #19 stub,
#20 the bottom bar started back under the e, #21 stub (the phantom period). Pictures: `docs/verification/trace-audit-2026-09-24/old-overlay.png`, `zoom-old-*.png`.

**What changed.** `scripts/capture/trace-logo.mjs` rewritten: pinhole fill, Zhang-Suen, the skeleton as a graph,
spurs under 1.6 ink widths pruned, junctions paired by straightest continuation, junction points pinned while
smoothing, one authored table of where a hand starts each letter. New file: 12 strokes, one per letter plus the
k's arm, 0 under the nib. Both e's start at the crossbar, the s's run top to bottom in one stroke, d runs bowl then
up the stem, o's anticlockwise from the top, k stem then arm. `_probe-letter-map.mjs`: 11 letters at the shipped
reach, word gap after the k, d and l separate. The old file is `scripts/capture/logo-strokes.before-2026-09-24.json`.
Pictures: `new-overlay.png`, `zoom-new-*.png`.

**Seen on the nib band, not changed:** at the hero nib (22.58, about 2x his 11-unit ink) the d stem and the l
still touch near the top. Their centrelines are 21 units apart there, so no stroke fix separates them without
moving his letters. That is the nib, and the call is his.

**Next step, exactly:** (1) check `ps -Ao command | grep film-hero-beat | grep -v grep` is empty, then
`FS_PORT=3105 FS_HEADED=1 node scripts/verify/film-hero-beat.mjs --label=strokes-fixed`; (2) crops of "les" in
draw, rest and hold, old film (`2026-09-24-look`) over new, and `strokes-fixed/word-old-vs-new.mp4`; (3) run
`assert-eye-draw-reads-written.mjs` (before 12 TWO / 4 JUMP / 0 POP / 0 FREEZE), `assert-eye-white-in-ink`,
`assert-eye-letter-overlap`, `assert-letter-seam`, `assert-hero-ledger`, `assert-hero-transition` on it and list
every row that moved (count reds from 22 to 12 strokes are expected). The "two places at once" overlap is the
schedule, not the JSON: look at `lib/pen-reveal.ts` `timeStrokesByPenModel` (`MS_GAP_BETWEEN_STROKES`) and
how `lib/hero-motion.ts` reveals, and report it, do not edit hero-motion.

### 2026-09-24 night: THE OVERNIGHT CHAIN, controller-run, one film at a time
His words: *"auto sleep mode to perfection mode... Stop stopping. You do not stop ever"*.
Order, each a lane, each filmed before and after, each looked at before it reports, none called fixed:
- **A** (running): the grid depth-fight through the "l" and "s" (`gridHelper`, viewport-3d.tsx ~9268),
  the blank blink at the turn edge (sliver back from the SOLID side, carve kept off the thick body:
  controller's call, since the ghosts are the worse defect), the lighter emerge turn-in.
- **D** (running, no browser): make `assert-eye-s-shape.mjs` real; run it on the old film and on
  `strokes-fixed`.
- **B** (next): the white nicks in the resting frames. After 77a44826 one shows where the Desk "s"
  meets the k stem at the hold; `assert-eye-white-in-ink` is the check.
- **C**: letters drawing in two places at once (`assert-eye-draw-reads-written` read TWO 12, JUMP 4
  on the old strokes); it lives in the schedule, `lib/pen-reveal.ts` `timeStrokesByPenModel` /
  `MS_GAP_BETWEEN_STROKES` and how `lib/hero-motion.ts` reveals strokes. Re-run the check on
  `strokes-fixed` first to get today's number.
- **E**: the animation controls findable before a stroke is drawn, and the debug readout
  (`raw 0 pts | processed ...`) off the product page.
- **Left for him:** the "d" and "l" touch at the top at the hero nib (22.58, about twice his ink).
  Separating them means a thinner nib or moving his letters.


### F118 step 1 note, 2026-09-24 late: the s-shape check RUN for the first time. Selftest half right. No film read. Still OPEN.
- **The outline TURN as written failed its own controls** on the first run: clean smooth s reads 144 deg, the zigzag 97. At the
  film's size (s 50 px tall, stroke 14 px) a smooth s's counters close to slits and their tips turn sharper than a zigzag's
  inner corner. Dropped before any film frame was read. The Moore trace and the dot loop both worked; the dot loop places
  dots at the asked gap (0.50, 0.81 to 0.86, 1.21 sw) and GAP reads right: touching red on GAP only, every clean pose clean.
- **Replaced with a pen-track TURN** (`assert-eye-s-shape.mjs`, rewritten): the centroid of each frame's new ink in each s
  pen-down, read with the draw check's own `analyse`, sharpest turn of that track. Controls are drawn point by point at the
  film's pen speed on the film's playhead times and read by the same code. Also finds the Desk s (the pen-down before the k
  stem; pen 2 in both films) and handles a film with no "." (GAP prints NOT MEASURED, exit 3, not a pass).
- **Selftest, window 0.1 sw, sigma 0.5 px, chosen on controls only:** old film's times (sw 14): ALL RIGHT at both heights
  (final s bar 76, zigzag 89; Desk s bar 67, zigzag 87). New film's times (sw 15, `selftest-new-film-params.txt`): FAILED at
  the final-s height, zigzag 82 under a 91 bar; Desk s right. The window sweep (0.1 to 0.7 sw, sigma 0.35 to 1 px) never gave
  more than about 20 % margin. Cause, seen in `control-clean.png`: track points sit one frame of pen travel apart (3 to 4 px)
  and a corner lands between two of them, so the reading depends on the sampling phase; the tight bowls (radius about 7 px at
  scale 0.85) turn about 50 deg per frame anyway. Tried and dropped: turn concentration (short window over long), noisier.
- **Seen by eye, not measured:** old film's final s is a "<" top, a bottom bar fused to the e, and a blob at the right end.
  New film's final s is one smooth-looking stroke, no blob, but its bottom bowl runs into the e's bottom (they touch).
- **Next, exactly:** make TURN phase-proof before any film is read. Try, on the controls only: (a) estimate the nib centre per
  frame, not the crescent centroid (fit a disc of radius sw/2 to the frame's new ink plus the prior frame's front), and read the
  turn over +-1 frame of travel; or (b) run every control at 4 sub-frame time offsets and set the TURN bar from the worst clean
  over all offsets, the zigzag judged on its LOWEST offset. Pass needed on BOTH films' parameters, then run
  `node scripts/verify/assert-eye-s-shape.mjs docs/verification/hero-beat-film/2026-09-24-look` and `.../strokes-fixed`
  (outputs land in `docs/verification/eye-checks-2026-09-24/s-shape/<film>/`), open `turn-final-s.png`, `turn-desk-s.png`,
  `worst-gap-*.png`. Remove the STATUS line at the file's top only then.

### 2026-09-25, after the crash: the budget, and the next browser wave
**The Mac crashed** from five parallel lanes (five `next dev` servers, one at 3.5 GB with a dozen PostCSS
workers, five headed Chromes filming). Measured afterwards with `scripts/verify/_probe-memory-leak.mjs`
(its own 6 GB watchdog): one tab idles at 1.0 GB, the hero at 1.2-1.4 GB, a looping play grows **about
88 MB/min** (a real slow leak, open). New rule, in `agent-worktree-hygiene` and memory: **at most two
browser lanes at once**, `df` and `top` before every server or film, servers stopped by exact pid.
Lane A's unfinished turn edits are saved as `docs/verification/night-a-wip/night-a-uncommitted-2026-09-25.patch`.

**Animation inventory:** `docs/animation-features-2026-09-25.md`, 112 controls, none checked by his eye.
Eleven look alive and draw nothing or draw the same (list (a) there). Cheapest real bug: the Material
toggle at `components/style-panel-scaffold.tsx:479` is missing the line that starts the style clock, so
Motion "Off" does not stop Material.

**Next browser wave, two lanes at a time, the inventory's list (c):** the default draw-in on Play; the
five Family-14 presets end to end; Window Travel, Vanish, Shrink (Travel's blank seam); stroke order x5
with Unit = stroke; Ease with Cadence twos; Loop + Reverse + Delay at the seam; Material x5 with Motion
Off and On; the Form's Shading and Turn on `/`; Fusion Turn Table, Still Wet, Glitch Ribbon; the hero's
letterByLetter film. Each filmed, looked at, graded 0 to 100 against his ledger, and fixed one at a time.

### F118 lane R note, 2026-09-25 ~04:40: the take no longer re-renders the 3D scene while it plays. CHANGED, measured. Gates NOT run. Still OPEN. Retired at 150k.
- **Correction to lane L:** `progress` was not set every frame. `onProgressUpdate` throttles it to one `setProgress` per 66 ms, so the host `Viewport3D` and, through `<Canvas>`, about 50 R3F components re-rendered 12.4 times a second. Nothing in the scene read that value; the scene reads `playheadRef` in `useFrame`. Only the take bar, the time label and the range input read it.
- **Changed, `components/viewport-3d.tsx` only:** `progress` moved from host `useState` into `createProgressStore` (get/set/subscribe). `setProgress` is now the store's setter, so every call site is unchanged. Three small readouts subscribe with `useSyncExternalStore`: `LiveTakeTimeline`, `ProgressTimeLabel`, `ProgressScrubber`. The compare cycle subscribes to one boolean, `progressAtEnd`. `formatDuration` removed (its one caller moved into the label). tsc 0 errors before and after.
- **Measured** (`docs/verification/night-r/probe-frames.mjs`, headless own Chrome, `/`, four mouse strokes, 20 s idle then 20 s playing on loop; commits counted by a stand-in devtools hook on both renderers):
  - dev before: R3F 12.4 commits/s, 657 R3F component renders/s, react-dom 12.4 commits/s; main thread 169.7 ms/s playing, 31.1 idle.
  - dev after: R3F 0 commits/s; react-dom 12.5/s rendering only the 4 readout components (50/s); main thread 76.7 ms/s playing, 31.7 idle.
  - prod (`next build` + `next start -p 3121`, 1.9 s compile) before: R3F 12.5/s, 612 renders/s, main thread 83.1 ms/s (script 51.6). After: R3F 0/s, main thread 57.8 ms/s (script 28.1).
  - Frame intervals, every arm, idle and playing: p50 16.7, p95 16.7-16.8, p99 16.8, max 16.8 ms, 0 over 20 ms, 0 long tasks. **Headless cannot show this cost as jank**: at about 1.4 ms of work per frame nothing drops. The 4x CDP CPU throttle arm (`prod-before-cpu4`) did not change task time, so it did not take effect; not trusted.
- **Picture** (`probe-still.mjs`, dev, fixed injected strokes, playhead set by the real range input at 0.25/0.5/0.75/1, full-page shot; `codeHasStore` proves which code was served): after vs after 0 px at all four; HEAD vs after 0 px at 0.5 and 1, 2 px at 0.25 and 0.75 with max channel delta 2/255. Opened both 0.5 shots: the same partial rod on the 3D side, same take bar fill, label 1.2s, identical.
- **Transport** (`probe-transport.mjs`, after only, `transport-after.json`): play advances, pause holds, scrub to 0.5 holds, loop wraps 0.939 to 0.004, reverse runs 0.6 down to 0.157, label and take bar track the range every sample, 0 page errors.
- **NOT DONE, next exactly:** (1) gates `assert-take-timeline`, `assert-drawin-timing`, `assert-harness-surface`, `assert-export-window`, `assert-drawin-attrs` on this tree and on HEAD's viewport file (git stash), rows that moved. (2) `probe-transport.mjs` on HEAD: "played past the end, no loop" stops at 0.988, not 1. The throttle keeps the FIRST value of each 66 ms window, so the final 1 can be dropped; likely pre-existing, not proven. (3) In `probe-frames.mjs` the post-pause scrub to 0.5 read 0.324 1.5 s later in every arm, before and after; the Pause there probably missed while the Timing popover was open. Not traced. (4) A headed or real-display frame-interval run; headless paces at a flat 16.7. (5) SolidAnimationTick still sets state at ~45 Hz in Solid/Extrude/Inflate; only Rod was measured.

### F118 lane S2 note, 2026-09-25 ~05:10: Solid, Extrude and Inflate while a take plays. Two lines CHANGED, measured in dev only. Gates NOT run. Prod after NOT measured. Still OPEN. Retired at 150k.
- **The per-frame state in these modes cannot move to a ref the way `progress` did.** `SolidAnimationTick`'s `setSolidAnimProgress` is what rebuilds the mesh, and the rebuild is the reveal. CPU profile, dev, Solid playing (`dev-before-solid-profile/frames.json`): 815 main-thread ms a second, 706 of them under `useStrokeMeshes` (`buildMaskSolid`; `detectInteriorHoles` alone 389), about 50 for React. Extrude: 172 ms/s, 47 in the rebuild, about 60 in React re-rendering Scene's ~25 children per tick. The tick syncs every second frame (22 ms throttle on a 16.7 ms frame), so 30 to 33 syncs a second, not 45.
- **Inflate on Auto (the default) already had 0 R3F commits while playing**, before this lane: it reveals by drawRange and the tick is off. Only Inflate's Loft still rebuilds per tick.
- **Changed, `components/viewport-3d.tsx`:** (1) the tick skips a sync whose reveal DISTANCE equals the last synced one (Natural holds the distance for the whole of each pen lift); Scene hands it `solidRevealFracRef`, the same `revealDistanceFraction` call the `animatedStrokes` memo makes; boundaries 0 and 1 still always sync. (2) The Inflate reveal-key effect compares before calling `setMeshesCarryRevealKeys`; the functional updater returning the same value still queued one empty R3F commit per tick on the Loft. tsc 6 errors before and after, all in `lib/geometry-engines.ts`, none in this file.
- **Measured, dev, headless own Chrome, 20 s playing on loop** (`probe-frames.mjs --mode= [--fusion=loft] [--gap-ms=]`; `codeHasDedupe` proves which code was served). R3F commits/s, R3F renders/s, main-thread task ms/s:
  - Solid, lane R's take (no lifts): 32.9, 822, 797 -> 31.9, 799, 779. Frames: p95 33.4, max 50.1 ms both, 259 of the play window's frames over 20 ms after. **Solid drops frames in dev before and after; the rebuild is ~21 ms per sync.**
  - Solid, 400 ms lifts: 32.9, 822, 788 -> 24.0, 600, 614.
  - Extrude, no lifts: 30.4, 760, 189 -> 30.4, 761, 197 (no change; noise). With lifts: 30.4, 759, 191 -> 22.7, 568, 166.
  - Inflate Auto: 0 R3F commits before and after, 81 ms/s both.
  - Inflate Loft, no lifts: 60.8, 790, 200 -> 30.4, 759, 196. With lifts: 60.8, 790, 198 -> 22.6, 566, 172.
  - Noise: one arm on the same code measured 180 and 196 ms/s on two runs; read ms/s differences under ~10 % as nothing.
- **Prod before only** (`next build` + `next start -p 3123`, no lifts): Solid 31.1 commits/s, 778 renders/s, 418 ms/s, 0 frames over 20 ms; Extrude 30.4, 761, 129; Inflate Auto 0 R3F commits, 56 ms/s. `build-after.log` compiled the change; the after arms were NOT run.
- **Picture** (`probe-still.mjs --mode= --gap-ms=400`, dev, injected two-stroke take, playhead by the real range input at 0.25/0.5/0.55/0.6/0.75/1; 0.55 and 0.6 sit inside the lift): before vs after 0 px changed at all 6 heads in all 3 modes. Positive control: 0.25 vs 0.75 differs by 12620 (Solid), 6964 (Extrude), 9659 (Inflate) px. Opened Solid 0.6, Extrude 0.75, Inflate 0.5, both arms: the same partial on the 3D side, same label, same take bar. The stills are paused scrubs, so they do not exercise the Solid hole streak during play (see below).
- **Known behaviour change, not measured:** Solid's hole activation needs 2 consecutive matching builds. Before, duplicate builds during a lift counted; now they do not, so a hole that closes right before a lift can switch on about 2 ticks later, after the pen moves again. Not filmed.
- **Seen, not this lane's:** Extrude's ribbon edges read stair-stepped and dark at this size in `still-*-extrude/head-0.75.png`.
- **NOT DONE, next exactly:** (1) start `next start -p 3123` on the build already in `.next` (after code), run `probe-frames.mjs` for solid, extrude, inflate, `--mode=inflate --fusion=loft`, each at `--gap-ms=0` and `400`; then `git stash push components/viewport-3d.tsx`, rebuild, run the lifted and loft before arms, `git stash pop`. (2) Gates `assert-take-timeline`, `assert-drawin-timing`, `assert-export-window`, `assert-drawin-attrs`, `assert-harness-surface`, `assert-implicit-reveal` on this tree and on the stashed file, every row that moved. (3) Film Solid playing on a take with a hole that closes right before a lift, before and after. (4) The real cost is Solid's ~21 ms rebuild per sync and, in Extrude, React re-rendering Scene's children per tick: the next change is either a cheaper partial Solid build during play or moving the rebuild into a child that owns the progress store. Neither is in the tick's lines.


### F118 lane SOLID note, 2026-09-25 ~12:30: Solid's rebuild made cheaper in three commits. Changed, here is the measurement, Node only. No browser run. Still OPEN.
Plan: `docs/research-2026-09-25/solid/PLAN.md`. Clone `.fs-lanes/solid`, branch `lane/solid`, commits `53189a4e4` (rig), `f521b6313` (A), `08abc69fb` (B), `9689ba7a9` (section 4). Rig: `scripts/verify/solid-bench/` (bench.mjs `--input=hero|o|shapes [--static] --against=`, make-mutant.mjs `--control=canvas-edge-only|pad0`, crossholes.mjs). Machine load average 25 to 44 from other lanes the whole time, so read timing as a ratio, not an absolute.
- **A, `detectInteriorHoles` floods only the ink's box plus a 1 px ring.** Identical to the tree before, geometry hash plus head validHoleCount plus partial centroids: hero 120 of 120 animated and 120 of 120 static, one "o" 120 of 120 both, SHAPES 5 of 5 both. Must-fail `canvas-edge-only`: hero and "o" 0 of 120 on every arm; SHAPES only 4 of 5 identical under it, so SHAPES alone is a weak witness. Timing, 3 interleaved runs, mean ms: animated 13.1 to 9.2, static 20.9 to 14.7.
- **B, raster read-back, labelling, component-mask copy and A's box search bounded to the stroke's dirty rect** (mask-space bbox padded by `ceil(lineWidth / 2) + 2`, both the main and the counter pass). Identity against the tree before A: the same 120, 120, 120, 120, 5, 5. Must-fail `pad0`: 0 identical on all six arms. A's control still drops hero and "o" to 0 of 120 on this tree. Timing against A: animated 9.7 to 4.1, static 16.6 to 6.1. Under Node the whole-canvas `getImageData` of `@napi-rs/canvas` was most of that; Chrome's read-back costs differ, so the browser number is not this one.
- **Section 4, the override went to every cluster whole and only the head cluster's holes reached Scene** (a missing cluster read as "no hole there"). Now each override hole goes to the cluster whose ink box, padded by half the line, holds its centroid (smallest box wins, -1 for none, shown in `SOLID_DEBUG.holeOverrideClusterOwners`). The box, not the partial outline, because `lib/solid-mask.ts` records that a centroid-inside-partial-outer test made active holes pop and was taken out. `mergeSolidResults` now concatenates every cluster's `stableHolesWorld` and partial centroids into `lastStages`, and `SOLID_DEBUG.lastClusterStages` holds each cluster's stages. `crossholes.mjs`: Desk given Doodles' 2 holes 2688 verts, holesUsed 2 before; 2224, holesUsed 0, owners [-1,-1] after, the same as Desk's own build. Whole word with Doodles' holes 6256 before, 5792 after, which is 2224 + 3568. The Play snapshot now holds 3 holes, not 2; with all 3 active the clusters use 2 and 1. With the empty override the geometry is 120 of 120 identical on hero both ways; the partial-centroid list is longer by design (67 of 120 full signatures match).
- **Gates, Node, before (712476268) and after each step:** `assert-harness-surface` 17 PASS lines, 0 FAIL; `assert-implicit-reveal` 10, 0; `assert-cap-fit` 49, 0; `assert-dead-code` 23, 0 (after section 4 it counts 221 declarations, not 220, the new owner function; 48 unreachable both). No PASS or FAIL line moved otherwise. tsc 6 errors before and after, the same 6.
- **NOT RUN, needs a browser slot:** `assert-take-timeline`, `assert-drawin-timing`, `assert-export-window`, `assert-drawin-attrs`.
- **Not done:** option C (per-cluster cache), not started; the lane hit its context line.
- **The browser pass still has to check (plan steps 4 to 6):** `probe-frames.mjs --mode=solid` at gap 0 and 400, dev and prod, commits/s, ms/s, frames over 20 ms, p95, before and after. `probe-still.mjs --mode=solid --gap-ms=400` at 0.25, 0.5, 0.55, 0.6, 0.75, 1: 0 px changed after A and B, and the 0.25 vs 0.75 control. After the section 4 commit a still may change on purpose where Desk's D gets its hole. Film Solid playing the hero word: does the D in "Desk" now get its hole before the last frame, does anything z-fight inside Doodles' holes, and does any hole pop in and out.
### F118 lane SOLID-2 note, 2026-09-25 ~13:10: the browser pass on lane SOLID's three commits. Changed, here is the film. Still OPEN until he looks.
Trees: before `712476268`, main's A and B `8043feb9e` (its product code is byte-identical to lane `08abc69fb`; only `docs/STATUS.md` differs), after `6e3a5f269` (A, B and section 4). Own headless Chrome through `scripts/verify/lib/browser.mjs`, dev :3133, prod :3134, every server killed by exact pid. Evidence: `docs/verification/solid/`, films `docs/verification/hero-beat-film/solid-{before,main-ab,after}/`.
- **Frames, night S2's `probe-frames.mjs --mode=solid`, 20 s of PLAY (R3F commits/s, main-thread task ms/s, frames over 20 ms, p95 ms).** Dev before gap 0: 31.0, 803, 280, 49.9 (run 2: 31.8, 811, 267, 49.9). Dev after gap 0: 30.4, 294, 0, 16.8. Dev before gap 400: 24.1, 634, 211, 33.4 (run 2: 23.7, 635, 205, 33.4). Dev after gap 400: 22.9, 229, 0, 16.8. Prod before gap 0: 31.0, 424, 0, 16.8 (run 2: 30.8, 409). Prod after gap 0: 30.4, 156, 0, 16.7. Prod before gap 400: 23.6, 334, 0, 16.7 (run 2: 22.9, 313). Prod after gap 400: 22.9, 130, 0, 16.8. Commits unchanged, ms/s down about 2.7x dev and 2.5x prod. Load average fell from 35 to 9 across the session; the before rows were re-run at load 9 to 14 and moved under 4 %.
- **Stills, night S2's `probe-still.mjs --mode=solid --gap-ms=400`, 6 playheads, 1,484,784 px each.** Main A and B against before: 0 px changed at all 6. After against before: 0 px at all 6. Positive control, 0.25 against 0.75: 12,620 px over 6 on both trees. That take is two strokes; section 4 cannot move it.
- **Hero word stills, paused after play, 9 playheads (0.1 to 1), viewport crop 756x850.** Before, main A and B and after: 0 px changed at all 9, every pair. Control 0.25 against 0.75: 13,675 px. So a paused scrub does not show section 4 at all; only playback does.
- **Film** (`docs/verification/solid/film-solid-hero.mjs`: logo-strokes injected on `/`, Solid radio, the page's Play, CDP screencast, real time). Before and main A and B look the same. During play the D of "Desk" is solid with no counter at 0.13, 0.25 and 0.44, and at 0.6 to 0.97 "Desk" reads as one slab with a web between D and e; Doodles' D and o's are solid too. After: Desk's D has its hole from 0.13, the first frame after its stroke closes, and holds it to the end; Doodles' D shows its hole by 0.6 and the o's theirs as each closes. Across a 30-cell strip (0.1 to 1) no hole appears then vanishes. No z-fight seen inside Doodles' holes at this crop, which is small (the word is about 350 px wide); a close crop was not taken.
- **Gates, dev, rows PASS/FAIL/VACUOUS, before then after:** `assert-take-timeline` 20/0/0 both. `assert-drawin-timing` 25/0/0 on 2 runs each, all 8 CONTROL rows passed on all 4 runs, so F108 did not flake here. `assert-export-window` 39/0 both. `assert-drawin-attrs` 19 rows all pass both. None of the four sets Solid: three run `/` in its default Rod, `drawin-attrs` runs `/desk-doodles` in Inflate. They say nothing else moved, not that Solid is right.
- **Not run:** prod film, a close crop of Doodles' holes, tsc (no .ts changed in this lane).

### F118 lane L note, 2026-09-25 night: the slow leak while a take loops on `/`. CHANGED, measured. Gates NOT run. Still OPEN.
- **Which process grows:** the renderer. Browser under 1 MB/min, GPU 0. `renderer.info` is flat the whole run, before and after:
  geometries 34, textures 5, programs 5, zero WebGL creates after the stroke lands (123 buffers, 9 textures, 5 programs, all made
  in the first 3 s). DOM nodes 536 to 541, V8 used 27 to 60 MB and collected. The GPU side was never the leak.
- **What grows:** `performance.getEntries()`, 57 to 47,218 in two minutes, about 390 a second. Every one is a
  `measure` named `"\u200b<Component>"` (x.useMemo, ForwardRef, Portal, PlaybackController...). Cause: `onProgressUpdate` sets
  `progress` every frame, so the R3F tree re-renders every frame, and R3F 9.6.1 carries its own react-reconciler 0.33 whose DEV
  build writes `performance.measure(name, {detail: props diff})` per component per render and never clears it. react-dom 19.2.4
  clears each one on the next line; the vendored copy does not. Chrome keeps them all. Dev only: the production reconciler in the
  same bundle has 0 measure calls.
- **Split, one variable** (`night-l/probe-variant.mjs --variant=nomeasure`, measure a no-op before load): steady slope from 60 s
  22.2 MB/min to 2.5. Same as the change.
- **Changed, `components/viewport-3d.tsx`** next to `progress`: a dev-only 2 s interval clears measures whose name starts with
  U+200B, by name. Nothing in the app or `scripts/verify` reads measures (grep). Entries now sawtooth 55 to 642.
- **Measured, 180 s each, headed, `--limit-gb=6`, linear fit, MB/min, whole tree:**
  play before 35.2 (all) / 22.2 (from 60 s); play after 15.2 / 2.3; idle after 3.2 / 4.1 (1.023 to 1.027 GB end to end);
  hero after -13.9 / 3.9. The "all" fit on play is the first 45 s: 0.48 to 0.61 GB renderer as V8's heap grows 22 to 84 MB, in
  every arm including nomeasure. 8 minute play after (`night-l/after-long/`): renderer 0.602 GB at 61 s, 0.616 at 481 s, fit 1.7 MB/min from 60 s, 3.6 over the whole run, so the warm-up is bounded.
- **The probe's watchdog was blind in every lane clone.** It matched `--fs-browser=free-stroke:<pid>:`, but the launcher writes the
  repo FOLDER name, `nightL` here, so it summed 0 GB and could never kill. Now matches any folder name, and refuses to run if it sees
  no process. Also added per-second `renderer.info`, WebGL create counts, DOM and V8 counters, entry count, transport label.
- **Not done, next exactly:** (1) gates `assert-take-timeline`, `assert-drawin-timing`, `assert-harness-surface` on this tree and on
  HEAD's viewport file, rows that moved. (2) Production build not measured. (3) The per-frame full-tree re-render during play is
  the root; it still costs CPU in production. Not touched.

### F118 lane C note, 2026-09-25 ~00:45: human pen lifts CHANGED in code, NOT FILMED. Still OPEN. Lane retired at 150k.
- **Cause, measured** (`docs/verification/hero-beat-film/night-c-after/probe-lifts.mjs`): Natural (`hybrid` 0.4) blended the
  pen toward ONE constant sweep of the whole word, which never stops, so every lift showed **0.0 ms of screen hold at all 11
  boundaries**. The draw check on `strokes-fixed` agrees: lifts 0-30 ms, TWO 1, JUMP 9.
- **Changed, `lib/pen-reveal.ts` only:** (1) `humanLiftsMs`, three tiers from write-on-timing §2.4 (90-150 within a letter,
  150-300 between letters, 300-600 between words), place in band set by travel (1 nib bottom, 8 nibs top), letters from
  `assignLetters`, word from `letterGapAfter`. Tiers came out right: k stem to arm within, k arm to Doodles D word, rest
  between. Uniform clock keeps 60 ms (negative control). (2) `penStrokeEvenFraction`: Natural's even half runs per stroke
  on the pen's clock and holds on lifts. Probe after: holds 43 to 174 ms on screen, record 13.318 s to 15.554 s, squeeze
  2.85x to 3.33x.
- **Node gates, committed file vs changed file, same exit codes on all 9** (5 red on both trees: pentip, stub-filter,
  timing-frames, timing, drawin-pacing; all pre-existing). Moved: drawin-pacing's shortest stroke on screen 84.5 ms to
  72.3 ms (the 100 ms floor row was already red, now further off); Natural vs Authentic gap 0.0367 to 0.0133 of the arc
  (still distinguishable).
- **Draw-in controls** (`probe-controls.mjs`, `controls-before.txt` / `controls-after.txt`): none went dead from this change.
  `order: byPosition` equals the default on BOTH trees, because the new trace already runs left to right: dead on this word,
  not caused here. **REGRESSION, NOT FIXED:** under any non-identity schedule (reversed, byLength, random, overlap 0.5/1,
  align end, unit stroke, window travel/shrink) the new lift holds ride the beat, not the stroke, so 65 of 400 clock samples
  hold with a stroke HALF DRAWN (0 before). Authentic (`raw`) already did this at 60 ms; it is now up to 581 ms.
- **Next, exactly:** (1) add an optional arg to `revealDistanceFraction` (lift holds on/off) and pass off wherever the
  viewport has a non-identity schedule (`components/viewport-3d.tsx` calls at ~5873, 5919, 6673, 8478; `lib/flat-ink.ts:585`;
  `components/take-timeline.tsx:234`), then re-run `probe-controls.mjs` until every hybrid row reads 0 mid-stroke holds.
  Decide raw's mid-stroke holds under a reorder (pre-existing, now larger) or leave it for him. (2) `df -g / | tail -1`
  (stop under 10 GB) and `top -l 1 -o mem -n 8`, start the :3112 server, film
  `FS_PORT=3112 FS_HEADED=1 node scripts/verify/film-hero-beat.mjs --label=night-c-after`. The before film
  `night-c-before` is complete (1311 painted frames, 0 console errors). (3) `assert-eye-draw-reads-written.mjs` on both films
  (before on strokes-fixed: TWO 1, JUMP 9, lifts median 10 ms), open the pen-order and a lift crop, and look. Kill the server
  by exact pids after.
### F118 note, 2026-09-25 night, lane M: Material animation measured under Motion Off and On. One toggle line CHANGED. Off still moves. Still OPEN.
- **Measured** (`docs/verification/night-m/probe-material-motion.mjs`, `/` on :3113, one injected stroke, playhead 1, 11 grabs over 2 s, px with any channel over 6/255 changed, largest vs the first grab; ink is about 26,600 px): Off moves shineSweep 20,131 · gelShimmer 26,609 · roughnessPulse 26,424 · completionFlash 26,552 (its one-shot decaying after arming) · signalFlicker 26,624. Independent: 19,348 · 26,618 · 26,505 · 0 (already spent) · 26,624. Sync to Draw with the playhead at rest: 0 on all five, which is correct. `before/` and `after-toggle/` agree within noise.
- **Changed:** `components/style-panel-scaffold.tsx:485-487`, the Material Animation switch now moves Motion mode from Off to Independent, the same line Texture, Dither, ASCII and Stack carry. Real entry path (`probe-material-toggle-ui.mjs`, mouse-drawn stroke, switch clicked): motion mode after the click was `off` at HEAD, `independent` with the line.
- **Why Off still moves:** the renderer never reads Off for Material. `components/viewport-3d.tsx` ~5557 gates `animOn` on `!reduceMotion` only, and the clock is `state.clock.elapsedTime` unless Sync to Draw. The stack's fix gated on the local `motionMode !== "off"` (~5214). That file carries another lane's edits and is not this lane's; an in-clone experiment was refused by the permission layer and backed out byte-identical, so the gate is UNMEASURED.
- **The trap in that one-line gate:** the 10 Animated Material rail presets (`lib/style-system.ts` ~1943-2095) write no `motionMode`, and `applyPresetToStyleState` wakes no clock. Today, picking "Shine Sweep" on a fresh page leaves Off and moves 1,716 px only because of the bug. Gate the renderer alone and the whole rail goes dead on a fresh page, the stack's own story. The gate and a preset wake have to land together.
- **assert-material-craft:** presets 1 of 13 red, PROVENANCE only: the 09-22 frames are older than `lib/hero-motion.ts` (09-24 23:33) because the freshness check takes the newest source file anywhere in the tree. Every preset pair passes. matanim 5 of 34 red: provenance (frames from 08-04) plus completionFlash on ink and chalk not moving, which is the one-shot being spent before the grabs start. dials 6 of 50: provenance plus emissiveIntensity inert end to end. No `* 2.png` in the clone's or main's material-craft. The 09-24 "6 of 13" was not reproduced; not proven where it came from.
- **Next, exactly:** (1) the owner of viewport-3d.tsx adds `motionMode !== "off" &&` to Material `animOn` and, in the same commit, has `applyPresetToStyleState` move Off to Independent when an `animatedMaterial` preset turns animation on; then `FS_PORT=<port> node docs/verification/night-m/probe-material-motion.mjs gate` (Off must read about 0 on all five, Independent must still move) and `probe-material-toggle-ui.mjs gate` (railPreset must move with mode `independent`). (2) Recapture `node scripts/verify/verify-material-craft.mjs --phase=matanim` and `--phase=presets` on a tree nobody else is editing, then the gate.

### F118 note, 2026-09-25 night, lane M2: Motion Off now stops Material, and the rail wakes the clock. CHANGED, measured. Exporter clock CHANGED, not measured. Still OPEN.
- **Changed, `lib/style-system.ts` `applyPresetToStyleState`:** a preset whose patch sets `materialAnimationEnabled: true` moves Motion from Off to Independent; Sync to Draw is kept. Derived in one place instead of written into the ten rail presets. Committed.
- **Changed, `components/viewport-3d.tsx`, NOT committed** (the file carries another lane's gridHelper edit): `docs/verification/night-m2/viewport-material-gate.patch`, three hunks. Material `animOn` gates on the local `motionMode !== "off"` (folds reduceMotion in, the stack's expression); the sweep clock and the material clock read the shared style clock `clock.elapsed` instead of R3F's `state.clock.elapsedTime`, and the local `motionMode` instead of `styleState.motionMode`. `patch -p1 --dry-run` applies clean to HEAD. The controller applies it.
- **Measured** (`night-m2/probe-m2.mjs`, headless, fresh `/`, stroke drawn with the mouse, solid, framed; max changed px vs the first of 11 grabs over 2 s, ink about 3,850 px). After: Off 0 on all five types; Independent shineSweep 3,740 · gelShimmer 3,851 · roughnessPulse 3,851 · completionFlash 3,729 · signalFlicker 3,854. Before (same probe, base code swapped in, then restored byte-identical by `cmp`): Off 3,752 · 3,854 · 3,854 · 3,729 · 3,854, so the instrument sees Off moving when it does. Rail, the real Presets chip, Family Animated Material, the Shine Sweep pill clicked: after, mode reads `independent`, 3,830 px; before, mode stayed `off` and moved 3,833 only because of the bug. Toggle, the real Material Animation switch: mode `independent`, 3,831 px.
- **Not done, exactly next:** (1) apply the patch, then measure the exporter: transparent APNG at 24 fps, Shine Sweep Independent, export once with `window.__fsExportStallMs = 0` and once with `90` (the drive/slow pair `scripts/verify/assert-export-app.mjs` uses); decoded frames should match under drive with the patch and differ with `__fsExportClock = "wall"`. Nobody has measured that the sweep follows the driven clock. (2) `assert-material-craft` was NOT run; matanim and dials need recapture on a tree nobody else is editing. (3) The stack rail has the same trap: none of the stack-animation presets writes `motionMode` and nothing wakes it, so on a fresh page they sit under Off. Not measured by this lane.
### F118 lane C2 note, 2026-09-25 ~01:15: lift holds gated by schedule, FILMED, draw check read. Still OPEN. Retired at 150k.
- **Changed** (`f6d66ea7`): `revealDistanceFraction(..., liftHolds = true)` and `liftsLandBetweenStrokes(schedule, windowMode)` in
  `lib/pen-reveal.ts`. The holds go off when any slot moved (reorder, overlap, align end, unit) or the window is travel or shrink.
  Reverse and vanish keep them, because their lifts still land at stroke ends. Callers: `lib/flat-ink.ts` drawAtTime (always a prefix,
  default on), `components/take-timeline.tsx` buildInverse, and the four viewport sites plus one import line, as a patch NOT applied
  on the main tree: `docs/verification/hero-beat-film/night-c-after/viewport-call-sites.patch` (5 hunks, `git apply --check` clean on
  HEAD and on the other lane's tree).
- **probe-controls** (`controls-lifts-gated.txt`): every Natural row 0 half-drawn freezes (was 65 of 400 on reorder, overlap, align,
  unit, travel, shrink).
- **HIS CALL, Authentic under a moved schedule:** raw reads its lifts from the recording's timestamps, so it cannot be gated without
  also shortening every real drawing's lifts. Same probe on the pre-664c1a16 file (loader mutation, nothing on disk): 6 of 400
  samples froze a stroke half drawn; now 65. Left as is.
- **Film** `night-c-after` (1300 frames, 0 console errors, draw 4.65 s wall, record 15.554 s, squeeze 3.34x). Fresh-code proof in
  `night-c-look/fresh-code-proof.txt`. ⚠ The film script WIPES its label dir: it deleted the probes and patch there; restored from HEAD
  blobs. Keep probes out of `night-c-after/`.
- **Draw check:** before TWO 2, POP 1, FREEZE 0, JUMP 6, lifts median 10 ms, max 70. After TWO 1, POP 2, FREEZE 5, JUMP 4, lifts
  median 40 ms, max 100. Read the crops: FREEZE 0053 (D done, before e) and 0193 (Desk done, before Doodles D) are the NEW LIFT
  HOLDS, filed as FREEZE because a few creep pixels at the stroke tail land after the hold (the gate's creep branch, :204). So on
  screen D to e is about 110 ms, Desk to Doodles about 180 ms. Real defects still: POP 38.7 sw at 0371 with FREEZE 60/50 ms inside
  pen 9 (the "d" region, x 0.73-0.83), a 1-frame stub at 0162 (TWO), JUMP at 0054/0094/0194/0383.
- **Strip** `night-c-look/strip-draw-before-over-after.png` (every 6th after frame, before at nearest time, B red over A blue).
  Seen, first two thirds: after holds a finished "Desk" from ~1.82 s to ~2.06 s before the Doodles D, before starts its D at 2.00 s;
  the pause between words now reads. Letters inside words still run close to back to back. Last third not opened.
- **NOT DONE, next exactly:** (1) open the last third of the strip and the crops at 0368-0381 (is the pen-9 POP a retrace?).
  (2) mp4: `ffmpeg` vstack of night-c-before/film.mp4 and night-c-after/film.mp4 cut to 0-4.7 s, into
  `night-c-after/draw-before-after.mp4` plus a README saying top = before. (3) gates `assert-drawin-timing`, `assert-hero-ledger`,
  `assert-drawin-attrs`, `assert-hero-transition` (the last needs a server; start :3112, kill by exact pids). (4) the squeeze
  question: strokes drew 230-590 ms each on screen, record 15.55 s shown in 4.65 s.

### F118 lane P note, 2026-09-25 ~01:30: the draw PACE measured against the Desk Doodles reference. NO CODE CHANGED. Still OPEN. Retired at the 150k line.
- **Clone state.** `git merge --ff-only` from main was REFUSED: this clone carries its own lane C commits (`664c1a16`, `f6d66ea7`,
  `4995d202`), the same code as main's `8a5011d8`/`27bace56`. `78cc4f07`'s viewport hunks are already in the uncommitted
  `components/viewport-3d.tsx`. Missing here: `74b0b114` (`ret.mode` still "changed"), which touches the return, not the draw.
- **The reference, found and opened.** `docs/verification/drawin-frames/lane9/drawin.webm` in the main tree, 08-01 11:20, 34 min
  after his "SPECILA DRAIWNG ANAIMTION IN DESK DDDOELS" message: the /desk-doodles hero page with the ENGINE pill on Desk Doodles,
  and the draw bar reading **4.67 s, the same draw beat as today**. The page's own label reads the playhead (video 57.0 s = 1.01 s,
  61.0 s = 5.01 s), so the tape is real time. Frames and a hand-written trace: `docs/verification/night-p/ref/dd-0801/` (README).
- **Draw check, same script, both films** (`docs/verification/night-p/check-ref.txt`, `check-before.txt`):
  | | reference 08-01 | ours, night-p-before |
  |---|---|---|
  | pen speed, raw new ink | 359 px/s, sw 14, word 714 px = **0.50 word widths/s, 25.6 sw/s** | 319 px/s, sw 15, word 615 px = **0.52 word widths/s, 21.3 sw/s** |
  | main strokes on screen | 280 to 640 ms | 280 to 580 ms |
  | lifts on screen | 0 to 80 ms, median about 40 (25 fps tape, under 40 ms is invisible) | 10 to 220 ms; the D to e and Desk to Doodles holds read as FREEZE 110 and 180 ms at the tail of the stroke before |
  | defects | 25: TWO 16, POP 7, JUMP 2 (the old trace's stubs pop whole) | 15: TWO 2, POP 1, FREEZE 7, JUMP 5 |
- **What that says.** The praised draw-in ran at the SAME pace as ours: the same beat, the same pen speed per word width, strokes
  the same length on screen, and shorter lifts than ours. So "the 3.34x squeeze makes it too fast" is not supported by the one
  film he praised; a longer beat or a smaller squeeze would move us AWAY from it. What he praised on 08-01 was the moving end
  (lane 9 that day measured Desk Doodles' tip 3.250, a nib, against Free Stroke's 0.417, a cut), not the timing. The draw beat is
  also held by the ledger: `hero-motion.ts` `draw: 140 / 30` clears C8's 36 % stillness bar by one third of a frame (36.1 %).
- **Seen by eye:** `docs/verification/night-p/ref/ref-strip.png` (every 160 ms): the reference writes letter by letter at a
  steady pace, round nib at the moving end, the old stub strokes ("." after D and after Dood) pop in whole.
- **Next, exactly:** (1) tile `docs/verification/night-p/pick-before-160/` and `pick-ref-160/` (same 160 ms times, word crops)
  into one strip, reference over ours, and OPEN it: judge the pen's path and pace, pairwise, against R. (2) Only if ours reads
  worse there, the one candidate the numbers leave is the speed profile INSIDE a stroke (Natural `hybrid` 0.4 toward even vs
  the lognormal record), compared as px advanced per frame across one stroke in both films; no beat or squeeze change. (3) The
  mp4 (`draw-3way.mp4`) needs an after film; with no change there is none, so make `draw-2way.mp4` (reference over ours,
  0 to 4.8 s, both scaled to the same word width) with a README saying the row order. (4) Gates were not run: nothing changed.
  Server :3112 was killed by exact pid.

### F118 lane pen note, 2026-09-25 morning: the hero opens on the Desk Doodles engine. CHANGED, filmed, GATES NOT RUN. Still OPEN. Retired at the 150k line.
- **Changed:** `app/desk-doodles/page.tsx`, the hero's `engineFamily` starts at `"desk-doodles"`. `/` and `DEFAULT_ENGINE_FAMILY` are untouched. The pill still flips it.
- **Films:** `hero-beat-film/pen-before` (Free Stroke) and `hero-beat-film/pen-probe-dd` (Desk Doodles, this code). The probe film IS the after; it has not been re-filmed under the name `pen-after`. Both 0 console errors, 0.900x real time, every phase present.
- **Measured (`docs/research-2026-09-25/pen/RESEARCH.md`):** width p90/p10 reference 2.56, before 1.50, after 2.44; median width 1.68 / 2.17 / 1.73 % of the word.
- **Seen, pairwise against the reference (`docs/verification/pen/probe-tile.png`):** after is closer than before. Thinner, tapered stroke ends, lighter weight. Still heavier at its thin end than the reference.
- **Seen, the moving end at 3x (`pen/probe-tip.png`):** NOT changed by the engine. Reference comes to a point; both of ours end in a flat chop, and the o of Doodles shows a white slit at the moving end. That is `lib/pen-reveal.ts` / the viewport tip field (F81), not this edit.
- **Seen, solid phases (`pen/probe-solid.png`):** standup, orbit, return turn and hold render on the Desk Doodles engine with thinner tapered tubes. Joint breaks and white spots NOT checked by gate.
- **NEXT, exactly:** (1) `FS_PORT=<port> node scripts/verify/film-hero-beat.mjs --label=pen-after` (or rename the probe). (2) Run `assert-eye-draw-reads-written`, `assert-eye-white-in-ink`, `assert-eye-letter-overlap`, `assert-eye-s-shape` on `pen-before` and `pen-after`; then `assert-drawin-pentip` (after `_probe-pentip-sweep.mjs`), `assert-hero-transition`, `assert-hero-ledger`, `assert-drawin-attrs --engine=desk-doodles` and without; diff every row. ⚠ `assert-letter-seam` clicks the Free Stroke pill itself, so it no longer grades what the hero ships. (3) The moving-end chop is the bigger gap to the reference: chase why the tip shape is inert on the hero (F81). (4) The online research on variable-width strokes was not done. (5) `pen/ref-before-after.mp4` not made.

### F118 lane PEN-2 note, 2026-09-25: pen-after filmed, two eye gates run on both films, the chop's layer found. NO product code changed. Still OPEN. Stopped at the context line.
- **Film:** `hero-beat-film/pen-after`, headless (`FS_HEADED=0`), :3130, committed 8b9802830. 813 painted frames, 0.899x real time, 0 console errors, every phase present. Frames 0200 and 0300 match `pen-probe-dd` at 0 px (>8 grey levels, of 941,920) and differ from `pen-before` by 3,312 and 5,056 px, so the film is the Desk Doodles engine.
- **Gates, frames over a bar (lower is better):** `assert-eye-white-in-ink` before 139 of 805 RED, after 146 of 805 RED (both exit 1). Every red is in tilt, standup, orbit and descend, column G; draw, emerge, returnTurn and hold are 0 red on both. The night-G note already reads G in 3D phases as the lit flank of a round tube, not ghosts. `assert-eye-letter-overlap` before 10 of 128 RED (emerge 5, returnTurn 5, all at w 0.01, an 8 px wide frame); after NOT RUN. `assert-eye-draw-reads-written` and `assert-eye-s-shape` NOT RUN on either film. `assert-letter-seam` NOT RUN; it clicks the Free Stroke pill before its first row, so on this hero it grades an engine the hero no longer opens on. No Desk Doodles variant was built. Outputs: `docs/verification/pen/gates/<gate>/<film>/`.
- **The chop's layer, measured live** (`docs/verification/pen/tools/probe-tip-path.mjs`, `tip-path/`): on the hero's default engine at 55 % of the draw the tip block is ON (`on 1`, `d 0.606`, reed `taper 0.00545` arc = 1.6 half-widths, `back 0`). F81's null uniform block does not reproduce here. At the moving end the five shapes DO differ by eye (`tip-path/modes-o-6x.png`: off and cut chop flat, nib rounds, reed and quill point); they differ by only 60 to 125 px of the frame, which is why a whole-frame count calls them indistinguishable. The film frame at the same playhead (`tip-path/film-vs-scrub-6x.png`) carries the reed shape too.
- **Cause, read from the code, not yet proven by a render:** `buildTipField` clamps `rhoN` to 1 nib half-width (`lib/pen-reveal.ts`, the `Math.min(1, ...)` in the final loop) and the shader clamps `fsRho` again. The Desk Doodles mesh reaches 1.59 half-widths (the table above `TIP_FIELD_REACH`). Every fragment between 1.0 and 1.59 half-widths gets the same lag, so the outer band is cut flat `taper x R` behind the pen: a short point in the core with a square shoulder either side. That is the chop and very likely the k-arm notch. The texture is RG FloatType, so values over 1 survive.
- **Next, exactly:** (1) finish the gates: `assert-eye-letter-overlap` on pen-after, `assert-eye-draw-reads-written` and `assert-eye-s-shape` on both. (2) Build the tip-width metric (max 2 x distance transform of ink within one median stroke width of the forward-most new-ink pixel, over the median width), positive control on the reference frames. The 08-01 reference frames were not located in this clone; the controller made `probe-tip.png` from them, so ask for the path. (3) Unclamp `rhoN` to `TIP_FIELD_REACH` in the bake and the shader's `fsRho` clamp (tip lines only), re-probe the five shapes, film, measure. (4) `pen/ref-before-after.mp4`.

### F118 lane PEN-3 note, 2026-09-25: tip-width metric built and controlled; lifting both rho clamps changed 0 px of the hero. NO product code committed. Still OPEN. Stopped at the context gate.
- **Metric:** `docs/verification/pen/tools/tip-width.mjs` (ink width square to the stroke at 0.25, 0.5 and 1 nib widths behind the leading ink pixel, nib = the frame's median ridge width; the lead is found by walking the last two intervals' ink, the axis from the ink 0.9 to 1.4 nibs behind it; skipped frames are counted by reason, never scored). `tip-crop.mjs` draws what it measured; `tip-end.mjs` grabs T-2d, T-d, T from the hero scrub and scores each mode.
- **Positive control, 08-01 reference** (main repo `drawin-frames/lane9/drawin.webm`, read in place, crop 800x360+150+400). Four takes; which key of `frames.json` each is was INFERRED from order, not checked. Pointed takes at 53.4 to 57.8 s: 0.333 / 0.438 / 0.632 (34 of 84 scored), and at 46.8 to 51.4 s: 0.316 / 0.417 / 0.708 (10 of 27). The thick takes at 7 to 16 s read 0.56 to 0.64 / 0.89 to 1.0 / 1.0.
- **Hero, before, 27 playheads 0.30 to 0.95, d 0.025 s** (`pen/tip-end/before/tip-width.json`): reed (shipped) 0.375 / 0.618 / 0.938, 12 scored; nib 0.854 / 1.021 / 0.958; off 0.5 / 0.854 / 1.125; **cut 0.75 / 1.063 / 0.896, the must-fail reads flat.** 10 of 27 playheads skip as "pen still" in every mode. A slanted flat cut reads narrow at 0.25 (off's 0.5), so the 1-nib column is the one that separates the reference's long point (0.63) from reed (0.94).
- **Clamps lifted** (`rhoN` unclamped in `buildTipField`, `fsRho = max(fsTf.g, 0.0)`): reed and cut read IDENTICAL numbers, and the grabs at 0.55, 0.775 and 0.90 differ from before by **0 of 943,040 px**. Either the dev server never served the edit (dev.log shows no compile line; not checked further) or this path does not draw the hero's moving end. The cause is NOT proven. Edit reverted.
- **NOT DONE:** o and k-arm 6x crops at 0.55, the Free Stroke pill check, the white slit, `pen-after2`, white-in-ink after, `ref-before-after.mp4`.
- **Next, exactly:** (1) put a deliberate break in the shader line (`fsRho = 0.0`) and re-grab 0.55; if 0 px move, the hero's end is not drawn by this block and PEN-2's layer reading is wrong, so find which path draws it (`__inflateProbe.drawDiag().diag.tip` on the frame). (2) If it moves, re-run `tip-end.mjs lifted` and compare the 1-nib column against 0.63.

### F118 lane PEN-4 note, 2026-09-25: the tip shader DOES draw the hero's moving end; reed's taper is the knob; NO product code committed, because reed 1.6 is his pick. Still OPEN.
- **Layer, proven.** The hero is family `desk-doodles`, and its moving end still goes through the Free Stroke tip field. Break `fsRho = 0.0` in the shader line; Turbopack rebuilt `.next/dev/static/chunks/components_viewport-3d_tsx_*.js` (the new string in it, the old one gone). Grab at 0.55: **104 of 943,040 px moved at T, 118 at T-2d, all in x 538..627 y 370..461, the "o" being drawn.** Noise control, same code grabbed twice: 0 px. Reverted, and a regrab matched the first base again (0 px). PEN-3's 0 px was not a stale server: the clamps never bind, because `fsTf.g` already sits in 0..1. `drawDiag().diag.tip` at 0.55: on 1, d 0.606, reed taper 0.00545 arc (1.6 nib half-widths), quill 0.00920.
- **Metric, `tip-end.mjs`, 27 playheads 0.30 to 0.95, 1-nib column deciding (reference 08-01: 0.333 / 0.438 / 0.632):**

  | arm | w0.25 | w0.5 | w1 | scored |
  |---|---|---|---|---|
  | reed 1.6 (shipped) | 0.375 | 0.618 | 0.938 | 12 |
  | cut (must-fail) | 0.75 | 1.063 | 0.896 | 12 |
  | quill 2.7 | 0.265 | 0.375 | 0.75 | 12 |
  | nose 1, taper 3 | 0.25 | 0.375 | 0.684 | 12 |
  | nose 1, taper 3.5 | 0.208 | 0.354 | 0.618 | 12 |
  | nose 1, taper 4 | 0.199 | 0.333 | 0.529 | 12 |
  | nose 1, taper 5 | 0.188 | 0.309 | 0.492 | 10 |
  | nose 1, taper 8 | 0.117 | 0.211 | 0.305 | 5 |

  Reed and cut reproduce PEN-3 exactly. The arms ran through `--shape=<nose>:<taper>` (added to `tip-end.mjs`, calls `__captureHarness.setPenTipShape`, the same reader the named shapes go through). "tip not one blob" skips rise with taper: 3 at 1.6, 5 at 3.5, 10 at 8.
- **Why nothing ships.** 3.5 lands on the reference, and it is longer than quill 2.70, which `lib/pen-reveal.ts` records as costing 12 blank px at the pen and detached pieces z 2.92. Reed 1.6 is recorded there and in `assert-pentip-specks.mjs` as his pick, taken for exactly that cost. So the change is a taste call against his own ruling, and `assert-pentip-specks` was NOT run on 3.5. The edit (`reed: { nose: 1, taper: 3.5 }`) was made, measured and reverted.
- **Crops, 6x at 0.55, before (reed 1.6) left, after (taper 3.5) right:** `docs/verification/pen/crops-pen4/o-055-pair-6x.png`, `karm-055-pair-6x.png`. Seen: the o's moving end goes from a squat, thick-shouldered wedge to a thinner lower edge running out to a finer point; its upper lobe does not change. The k arm is identical in both (0 px differ outside the o), because at 0.55 it is a finished stroke end, drawn by the engine's own end taper, and already a long fine point. That finished end is still much finer than any moving end at 1.6. Both crops show a light vertical slit where the o meets the D, before and after.
- **Next:** show him `o-055-pair-6x.png` and ask 1.6 or 3.5 for reed. If 3.5, capture a reed-3.5 arm for `assert-pentip-specks` and count blank px at the pen before it ships. The slit is separate and not touched.

### F118 lane PEN-5 note, 2026-09-25: reed 3.5 measured beside 1.6 and quill 2.7 on a fresh capture; the slit is NOT at rest, layer NOT proven. NO product code changed. Still OPEN. Stopped at the context gate.
- **Method.** `_probe-pentip-shape.mjs` with a temporary `t350` arm (quill, nose 1, taper 3.5, AA on, beside `t310`), reverted after the capture. Two captures on today's tree, :3130, 201 samples, 11 arms: `docs/verification/pen/specks/dsf2` and `dsf1` (meta, specks.json, `gate.txt`, `capture.txt` committed; the 160 MB of frames are NOT committed and live only in this clone). Graded with `assert-pentip-specks --dir=`, no bar touched. `free-stroke` is quill 2.70 through its name, `t160` is reed's 1.6 through the override, the reference is chisel 0.85.
- **dsf 2, 150 paired frames (of 201 captured), exit 1:**

  | arm | detached pieces z (bar 2) | frames up / down | blank px at pen, total / holes | worst frame vs chisel (bar 7.5) |
  |---|---|---|---|---|
  | chisel 0.85 (ref) | n/a | n/a | 81 / 4 | n/a |
  | reed 1.6 (t160) | 2.00 | 4 / 0 | 51 / 3 | **+10, FAIL** |
  | quill 2.70 | **2.89, COST** | 11 / 1 | 44 / 3 | +3 |
  | reed 3.5 (t350) | **2.67, COST** | 12 / 2 | 41 / 2 | +0 |

- **dsf 1, 148 paired frames, exit 0, all 43 rows green:** reed 1.6 z -1.00, 5 blank px in 1 hole, worst +0; quill 2.70 z 0.90, 5 / 1, +0; reed 3.5 z 1.60, 5 / 1, +0; chisel 13 / 2.
- **What that says for his call.** On this tree 3.5 does NOT cost blank paper: 41 px against 1.6's 51 and quill's 44, and its worst frame is +0 where 1.6's is +10 and fails. It DOES cost detached pieces at dsf 2 (z 2.67, 12 frames gain one against 2 that lose one), about what quill costs (2.89). The "12 blank px, z 2.92" in `lib/pen-reveal.ts` does not reproduce on either fresh capture; the old `tipshape-sweep` capture re-graded today gives quill 8 px / z 2.12. Noise floor: the divisor-only null pair moves 0.05 px per frame.
- **The slit, measured.** `docs/verification/pen/tools/slit-count.mjs` (light px with ink within 3 px on both sides in the row; selftest: clean 0, planted 20 reads 20, beside a counter 20), `slit-scan.mjs` (every 0.1 s over the whole 12.37 s, phase and `drawDiag` per grab, `slit/base/slit.json`), `slit-crop.mjs` (6x, plain beside marked).
  - **Seen, `slit/base055-6x.png`:** the light vertical line at x 597 runs down the join of the D's bowl and the o at 0.55; the counter marks it (33 px at T-2d). The grid line is 10 px left, at x 587, in paper. So it is not the grid line.
  - **Seen, `slit/base-rest-6x.png` (breath 5.0, solid 7.5, hold 12.2): no slit at rest.** The join is solid ink. The 16 to 17 px the counter reads there are the paper notches above and below the join, not a slit, so the counter's floor at rest is 16 to 17 px and it cannot tell the slit from those notches by count alone. Every draw frame from 0.557 on reads 15 to 22, inside that floor; only 0.536 (29) and T-2d at 0.55 (33) stand clear of it.
  - **Ruled out by the scan:** the joint break (`jointBreakState` 0 on all 124 grabs). The carve is 0.7 through the draw and 0 in land and solid, and the tip is on only in the draw, so the slit tracks the draw, where carve and tip are both live. Which of those two draws it is NOT proven.
- **Next, exactly:** (1) shrink the counter to one column wider than 1 px tall runs (a slit is at least 4 rows tall; the notches are 2 to 3), check it reads 0 on the three rest frames and 33-ish at 0.55 T-2d. (2) Deliberate breaks through the harness, no code edit: `setCarveAA(false)`, `setTipAA(false)`, `setPenTip("off")`, then `setFlatten({penCarve:0})`, each at 0.536 and 0.55, `slit-crop` each and open it. (3) Only a proven single line gets changed, then `assert-eye-white-in-ink` on a fresh film. Reed 1.6 or 3.5 is his call on the table above.

### F118 lane PEN-6 note, 2026-09-25: the o/D slit goes with the pen tip, and only with the tip. NO product code changed. Still OPEN.
- **Counter, changed.** `docs/verification/pen/tools/slit-count.mjs` now counts a candidate px only inside a column run at least 4 rows tall. That alone did not reach 0 at rest: the V-notch under the o/D join is 5 rows tall, not 2 to 3, and read 5 / 4 / 5 on breath 5.0, solid 7.5 and hold 12.2. So every count is also paired with the finished word (`--rest=`): a px counts only if it is ink at rest. Rest frames then read 0 / 0 / 0. Selftest: clean 0, planted 20 reads 20, beside a counter 20, a 3-row notch adds 0, a 4-row one adds 4, a notch that is paper at rest adds 0 under pairing; it exits 1 if the pairing is dropped. `slit-scan.mjs` gained `--call=` (any boolean `__captureHarness` setter, refusal throws), `--shares=` and `--rest-t=` (grabs its own rest frame under the same break). `slit-crop.mjs` takes `file@rest.png`.
- **Which frame "0.55" was.** PEN-5's 33 px "at 0.55" was tip-end's T-2d grab, T minus 0.05 s, which is 0.539 of the draw. So three shares were grabbed: 0.536, 0.539 and 0.551. At a true 0.551 the base already reads 0.
- **Breaks, :3130, dsf 1, box 560,370,629,449, paired with each arm's own 12.2 hold:**

  | arm | 0.536 | 0.539 | 0.551 | hold |
  |---|---|---|---|---|
  | base | 14 | 14 | 0 | 0 |
  | `setCarveAA(false)` | 14 | 14 | 0 | 0 |
  | `setTipAA(false)` | 15 | 12 | 0 | 0 |
  | `setPenTip("off")` | **0** | **0** | 0 | 0 |
  | `setFlatten({penCarve:0})` | 24 | 18 | 4 | 0 |

  `setCarveAA(false)` did take: 954 to 992 px differ from base per frame (`pxdiff.mjs`), none of them at the join.
- **Seen, `slit/break-0536-6x.png` and `break-0539-6x.png`:** base, carveAA off and tipAA off all show the same 1 to 2 px light column between the D's bowl and the head of the o being drawn, running parallel to the D's edge; tipAA off only makes the edges stair-stepped. penTip off: the o's head is a plain wedge that reaches the D, no light column. penCarve 0: the column stays and a second light run opens above it, and the D gets a pale rim. **`slit/break-0551-6x.png`:** base shows a dotted mid-grey seam at the join, not paper; penTip off and tipAA off are solid; penCarve 0 shows a 4-row light line.
- **Layer, proven by break:** the pen tip (`setPenTip`). It is the only break that takes the slit to 0 while the base shows it. Not the carve, not either AA divisor.
- **Not fixed, and why.** Turning the tip off is a break, not a fix, and no one-line change in the tip layer was found in this lane's budget. The column runs parallel to the D, not along the o's nose, so the likely place is how the tip field decides coverage where the arriving o overlaps ink the D already laid down. Not proven.
- **Next, exactly:** read the tip-field fragment test in `components/viewport-3d.tsx` where the o's head overlaps the D, and try one line through a harness setter first. Then 0.536 / 0.539 through `slit-scan.mjs --shares=0.536,0.5393,0.55 --rest-t=12.2`, and a fresh `film-hero-beat` with `assert-eye-white-in-ink`.

### F118 lane PEN-7 note, 2026-09-25: the o/D slit CHANGED, two causes, both in the tip layer. tip-end MOVED, film NOT run. Still OPEN.
- **Read, not guessed.** A temporary hook dumped the live tip field at 0.536 (D = 0.5887, reed taper = 1.6 R). Two causes, in this order of count:
  1. **A later pass steals an earlier pass's skirt.** `buildTipField` takes `coverArc` (nib within R) over the skirt. Texels up-left of the o's start, at (638,110), read arc 0.6448, which is the o's CLOSING end, 200 units past the head, while the o's start is 1.19 R away at 0.5778. Texels on the o's outer edge beside the D (614,140) are covered by the o at 0.5864 and cut by the taper, though the D's samples are within 2 R. Change, `lib/pen-reveal.ts`: a third accumulator `reachArc` keeps the earliest closest-point arc within `TIP_FIELD_RETURN_SKIRT` (2.0 R, the widest mesh measured); the texel takes it only when it is more than 3 R of pen travel earlier than its own arc, i.e. a separate pass, never the moving end of one pass.
  2. **The AA ramp at an arc jump.** Where D texels (0.52) meet o texels (0.58), `fwidth(fsTsd)` is hundreds of units and the ramp reads about 0.5 on ink far behind the head: a light 1 px seam. Change, `components/viewport-3d.tsx` tip shader: `fsTpx = min(fwidth(fsTsd), 4.0 * unit)`, program key v3 to v4.
- **Slit, `slit-scan.mjs --shares=0.536,0.5393,0.551 --rest-t=12.2`, :3130, box 560,370,629,449, paired with each arm's own hold:**

  | arm | 0.536 | 0.539 | 0.551 | hold |
  |---|---|---|---|---|
  | base (4df729461) | 14 | 14 | 0 | 0 |
  | skirt texels forced drawn (break, reverted) | 14 | 14 | 0 | 0 |
  | return-pass only | 11 | 15 | 0 | 0 |
  | AA cap only | 13 | 13 | 0 | 0 |
  | **both (committed)** | **0** | **0** | 0 | 0 |

  The skirt break did take (291 px differ, `pxdiff.mjs`), so the slit is covered texels, not skirt. Neither change alone reaches 0.
- **tip-end, NOT unchanged.** Same tool, same run shape, base run fresh this lane (`tip-end/pen7-before`) against `tip-end/pen7-after`:

  | mode | scored | w0.25 | w0.5 | w1 |
  |---|---|---|---|---|
  | reed, before | 12 | 0.375 | 0.618 | 0.938 |
  | reed, after | 11 | 0.375 | 0.596 | 0.917 |
  | cut, before | 12 | 0.75 | 1.063 | 0.896 |
  | cut, after | 12 | 0.75 | 0.917 | 0.896 |

  Per playhead, reed differs at 9 of 27 (0.55 w1 0.86 to 0.708; 0.5 and 0.675 fall to skips; 0.325 joins). The cut must-fail still reads flat at w1. No repeat of the base was run, so tip-end's own run-to-run noise is NOT known; the 9 rows are not yet attributable to the change.
- **Seen, `slit/pen7-0536-6x.png`:** before, a light column and a concave notch between the D's bowl and the o's wedge. After, the wedge meets the D with no light column, but the o's top edge near the join is stair-stepped in 1 px steps and its underside has a jagged tooth. Changed, here are the crops; not fixed.
- **tsc 6 errors, baseline 6.** Not run: `film-hero-beat` and `assert-eye-white-in-ink` against PEN-2's pen-after (146 of 805). Lane stopped at its context limit.
- **Next, exactly:** (1) run tip-end base twice to get its noise floor, then judge the 9 rows. (2) `FS_PORT=3130 node scripts/verify/film-hero-beat.mjs` then `assert-eye-white-in-ink`, draw / emerge / returnTurn / hold at 0 red, against PEN-2's 146 of 805. (3) The stair-step on the o's top edge is the capped ramp at the arc jump; if his eye rules it out, try the cap at 6 or 8 units and re-read the slit.

### F118 lane PEN-8 note, 2026-09-25: the tip ramp CHANGED back to fwidth except at an arc jump. Slit 0, the o's top edge soft again, tip-end noise floor 0, film run. Still OPEN.
- **Changed, `components/viewport-3d.tsx` tip shader:** `fsTpx = fsTfw < 32 * unit ? fsTfw : 4 * unit`, where `fsTfw = fwidth(fsTsd)`. PEN-7's `min(fwidth, 4 * unit)` clipped the ramp on every edge whose own gradient runs past 4 units (the taper and the nose's sqrt near rho 1), so those edges lost their greys. Program key v4 to v5. `lib/pen-reveal.ts` (PEN-7's reachArc) untouched.
- **New instrument, `pen/tools/edge-soft.mjs`:** walks every row and column of a box, counts paper-to-ink crossings, and calls one SOFT when a grey pixel sits between. Default box x 603..628, y 412..428, the o's wedge at 0.536, clear of the D's bowl. Validated before use on PEN-7's own grabs: base must pass and did, cap 4 must fail and did.
- **0.536, slit-scan paired with the hold, edge-soft on the same grab:**

  | arm | slit 0.536 | slit 0.539 | slit 0.551 | hold | o top edge soft |
  |---|---|---|---|---|---|
  | base (4df729461, `pen7-base`) | 14 | 14 | 0 | 0 | 36 of 43 (0.84) |
  | base again (`base2`) | | | | | 36 of 43 (0.84) |
  | PEN-7 return-pass only (`pen7-after`, no cap) | 11 | 15 | 0 | 0 | 33 of 39 (0.85) |
  | PEN-7 cap only (`pen7-caponly`) | 13 | 13 | 0 | 0 | 16 of 43 (0.37) |
  | PEN-7 both, cap 4 (`pen7-after2`) | 0 | 0 | 0 | 0 | 22 of 41 (0.54) |
  | **PEN-8, jump 32 (`pen8-j32`)** | **0** | **0** | 0 | 0 | **35 of 41 (0.85)** |

  Whole frame against base: PEN-8 differs at 104 px, all inside x 538..624, y 370..446 (the join). The hold frame is byte-identical to PEN-7's. Only one threshold was run; 32 met both bars, so 6 and 8 unit caps were not tried.
- **tip-end noise floor is 0.** Base run twice this lane (`tip-end/pen8-base1`, `pen8-base2`) plus PEN-7's `pen7-before`: all 27 rows identical in both modes, every value. So any row that moves is the tree, not noise.

  | mode | run | scored | w0.25 | w0.5 | w1 |
  |---|---|---|---|---|---|
  | reed | base x3 | 12 | 0.375 | 0.618 | 0.938 |
  | reed | PEN-8 | 11 | 0.375 | 0.596 | 0.917 |
  | cut | base x3 | 12 | 0.75 | 1.063 | 0.896 |
  | cut | PEN-8 | 12 | 0.75 | 1.063 | 0.896 |

  Reed moves at 7 of 27 rows against base: 0.325 joins (w1 0.917), 0.5 and 0.675 fall to skips, 0.55 w1 0.860 to 0.708, 0.475 and 0.575 by 0.02. PEN-8 against PEN-7 differs at only 2 reed rows (0.625, 0.95, by 0.02) and 1 cut row, so the reed movement is PEN-7's reachArc, not the ramp. The cut must-fail medians are flat; 5 cut rows do move per playhead (0.325 joins, 0.5 skips, 0.475, 0.55, 0.85).
- **Film `hero-beat-film/pen-after3`, `assert-eye-white-in-ink` (output in `pen-after3/white-in-ink/`):** 142 of 802 red, exit 1, against PEN-2's pen-after re-run through the same gate this lane, 146 of 805. draw 0 of 276, emerge 0 of 55, returnTurn 0 of 55, hold 0 of 103: all 0. Reds are tilt 12, standup 73, orbit 56, descend 1, every one with G; 8 standup frames also carry A (PEN-2's film has 7). No gate or bar edited.
- **Seen, `pen/slit/pen8-0536-6x.png` and `pen8-wedge-0536-6x.png` (base, PEN-7, PEN-8):** base, the wedge stands apart from the D with a light column. PEN-7, the wedge meets the D, and its upper-left edge is hard black-on-white 1 px steps. PEN-8, the same edge carries a grey pixel on each step, reading like base; the luma values on rows 419 to 423 match base's exactly (132, 138, 51, 46, 63, 208). Still there in PEN-8, and also in PEN-7: a 1 px paper notch where the wedge's top meets the D (603,425), a jagged tooth under the join at (601,439..440), and a new faint speck, luma 241 on 250 paper, at (609,440). The tooth and notch come from the return pass, not the ramp. Changed, here are the crops.
- **tsc 6 errors, baseline 6.**
- **Next, exactly:** (1) his eye on `pen8-wedge-0536-6x.png`: the tooth under the join and the notch at its top. (2) If the reed row at 0.55 (w1 0.860 to 0.708) matters, it belongs to reachArc in `buildTipField`, not the shader.

### F118 lane PEN-9 note, 2026-09-25: reed 3.5 verified on 6724ef98f. The o/D slit is back at 4 px, and the taper is the layer. No product code changed. Still OPEN.
- **tip-end (`pen/tip-end/pen9-base`):** reed 12 scored, w0.25 0.199, w0.5 0.397, **w1 0.583**, not the 0.62 PEN-4 read at 3.5 (`pen4-taper3.5`, a tree before PEN-7's reachArc). Cut 0.75 / 1.063 / 0.896, identical to PEN-8's base x3: the must-fail is flat.
- **assert-pentip-specks, exit 1, 4 failures:** 1 FAIL, PROVENANCE: `pentip/ship-dsf1` frames are 0.56 h older than `lib/pen-reveal.ts` (main's edit), recapture with `_probe-pentip-shape.mjs --label=ship-dsf1 --dsf=1`. 3 COST rows: worst single frame +4 / +4 / +3 px on the 2.70, 2.75 and 3.10 arms. No row fails because a comment or constant names 1.6: IDENTITY passes and reads "source ships reed at nose 1 / taper 3.5". The capture has no 3.5 arm at all. No bar edited, nothing recaptured (`pentip/` is not this lane's).
- **Slit, box 560,370,629,449, paired with 12.2:** 0.536 **4**, 0.539 **4**, 0.551 0 (`pen/slit/pen9-base`). Bar was 0; it fails.
- **Layer, proved:** reed taper set back to 1.6 on this tree (`pen9-reed16`) renders PEN-8's `pen8-j32` 0.536 grab byte for byte (0 of 943,040 px) and reads slit 0. So the 4 px is main's 3.5, not drift. Mechanism, from the uniforms (`probe-tip-path --at=0.536`): reed taper = 0.01192 of the arc, the head is at 0.58874, the o starts at 0.5778, so the o's start-cap edge (rho near 1) comes in at 0.5897, 0.001 after this frame. At 1.6 the same edge lands at 0.5832, before it.
- **Return pass, deliberate breaks at 3.5:** (A) resolve always takes `own` (`pen9-breakA`): slit 18 / 28; the return pass fills x 599..602 but column 603 is paper either way, so the notch is NOT a returned texel. (B) rhoN 0 on returned texels (`pen9-try1`): column 603 and the tooth unchanged, and a new speck, luma 198, at (609,440). (C) `TIP_FIELD_RETURN_SKIRT` 2.3 (`pen9-skirt2.3`): slit 0/0/0; (603,425) ink, the tooth (601,439..440) ink, (609,440) paper; edge-soft 39 of 47 (0.83) against base 40 of 46 (0.87). But a 1 to 2 px paper groove opens at x 606..607, rows 421..425, between the D-side spike and the wedge, 3 rows tall so the counter (4-row runs) cannot see it. (D) skirt 2.6 (`pen9-skirt26`): slit 0, the groove moves to x 607 rows 421..424, 1 px, and the lower join steps hard (21 to 250). Every skirt moves the groove; none removes it, because the paper is the o's own start cap under the long taper.
- **Speck (609,440):** 250, paper, on base 6724ef98f already. It was a 1.6 pixel.
- **Edge-soft, o top edge, base 6724ef98f:** 40 of 46 (0.87). Soft.
- **Film `hero-beat-film/pen-after4` (base 6724ef98f), `assert-eye-white-in-ink`:** 146 of 794 red, exit 1. draw 0 of 268, emerge 0 of 53, returnTurn 0 of 55, hold 0 of 103. Reds: tilt 12, standup 75, orbit 56, descend 3 (PEN-8's pen-after3 had 142 of 802).
- **Seen, `pen/slit/pen9-wedge-0536-6x.png` (base 3.5, reed 1.6 control, break A, skirt 2.3, skirt 2.6):** base 3.5, a V of paper 3 px wide between the D and the wedge's top, with a small spike off the D inside it; red marks its left wall. 1.6, the wedge meets the D with PEN-8's 1 px notch and the faint speck below. Break A, the wedge stands clear of the D by a wide gap. Skirt 2.3, the spike fills to the wedge, the tooth under the join is gone, and a narrow V notch stays between spike and wedge down to the join. Skirt 2.6, that notch is a 1 px line and the lower-left edge reads stepped.
- **Not changed:** `lib/pen-reveal.ts` is byte-identical to 6724ef98f. Skirt 2.3 meets every named bar (notch, tooth, speck 0, slit 0, edge soft) and still leaves a groove, so it is not shipped as a fix; tip-end and the film were not run on it.
- **tsc 6 errors, baseline 6.**
- **Next, exactly:** (1) his eye on `pen9-wedge-0536-6x.png`: is the 3.5 start-cap gap at the o the taper he wants, or a defect. (2) If a defect, the layer is how the taper treats a stroke's START cap (when = arc + taper x rho, `components/viewport-3d.tsx` ~2670), not reachArc; that is a look change at every stroke start and his call. (3) Recapture `pentip/ship-dsf1` so PROVENANCE reads the 3.5 tree.

### F118 note, 2026-09-25 night, lane S (clone nightE): stack presets CHANGED, Family-14 half filmed. Still OPEN.

- **Clone not level with main.** `merge --ff-only` refused: the clone's two lane-M commits were cherry-picked onto main as 51e72c2b and bab583d9, so the histories diverged. Nothing was checked out, stashed or reverted. `lib/style-system.ts` and `lib/style-fusion.ts` were byte-identical to main before this lane; the runtime lacks lane C's Natural lift holds (8a5011d8, 27bace56, 78cc4f07).
- **Stack presets, changed, commit baabfc6f.** `applyPresetToStyleState` now moves Motion Off to Independent when a preset turns stack animation on, beside the Material wake. Probe `docs/verification/night-s/probe-stack.mjs`, fresh `/`, mouse stroke, Solid, 11 grabs over 2 s:
  - composed stack (grain + Bayer + ASCII, static), Motion left at Off: **before 0 of 12, after 10 of 12, 9,498 to 16,009 px**. The Independent control read the same 10 before the change.
  - app default, nothing composed: 0 of 12 before and after. By design: the group has no layers. The Presets panel already says so in orange (`presetStateGap`), seen in `night-s/stack-after/ui-presets-stack-fresh.png`. The Layers panel's own stack-preset row (style-panel-scaffold.tsx:1694) carries no such line; that file is not this lane's.
  - The two zeros left: Freeze On Complete (freezes static layers, correct) and Reveal Track (rides the playhead, parked at 1). The census zeros for Drift Back, Whisper, Slow Breath, Hard Loop under Independent were the instrument: here they move 9,534 to 15,766.
- **Gates.** `assert-fusion-two-dead` recaptured to `night-s/two-dead`: 12 of 12. `assert-fusion-combo-ui` 14 of 14. `assert-stack-anim` was provenance-stale before and after the edit; recaptured with `verify-stack-anim.mjs` (overwrote `docs/verification/stack-anim-v1`, left UNCOMMITTED, outside this lane's paths): all rows pass.
- **Family-14 films**, real play loop, `night-s/film-presets.mjs`, sheets in `night-s/film-f14/`. Opened two of five:
  - Snappy Draw: the first four strokes are down by 3.8 s; the X's second stroke then crawls from 5.1 s to 8.2 s, ink 26,779 to 28,015 across the last 1.9 s. Reads as a stall on one stroke. Matches its own copy ("slowing toward the last"), so a design call, not a bug.
  - Slow Gel: 3.4 s of near-blank page (ink under 1,500 px) before anything reads, not "a beat"; units do not land together, the X's last stroke finishes alone near 9.4 s. The copy overstates.
- **NEXT STEP:** open `night-s/film-f14/{Authentic-Draw,Smooth-Reveal,Looping-Stroke}.png` and `profile.png`, grade all five against LEDGER MOTION/LOOK; then `FS_PORT=3113 node docs/verification/night-s/film-presets.mjs fusion fusion` and open Turn Table, Still Wet, Glitch Ribbon. Still Wet is the surface-only fusion cell added 2026-08-04: `FUSION_PRESETS` lib/style-system.ts:1357, def :4268, links `BUILTIN_LINK_FUSIONS.stillWet` lib/style-fusion.ts:1210. Not graded yet.
### F118 lane W note, 2026-09-25 ~02:30: window modes and the loop seam FILMED; Travel's loop seam CHANGED, gates-after NOT run. Still OPEN. Retired at 150k.
- **Rig:** `docs/verification/night-w/film-windows.mjs` (a word "hellow!", 9 strokes, drawn with the mouse on `/`, 6.2 s take, real Play,
  rAF playhead trace, every rAF frame at the seam re-rendered by seek and grabbed). Per case: `<label>/<case>/{take.png, seam.png, metrics.json}`.
  Bar set before any after-film: a seam frame under 2% of the whole word's ink is a near-empty page.
- **Before (19 cases, `night-w/before/summary.json`):** 0 stalls over 90 ms in any case except the delay itself; 0 page errors. Travel 25% loop:
  13 seam frames under 2% (min ink 55 px, a speck); travel 75% loop 8; travel reverse loop 13; travel inOut loop 22 of 22.
  Travel once ends on an empty page (21 blank frames at the end, 16 of 131 grabs blank), F95 by construction, left.
- **Seen, travel 25% loop before:** the quarter-word segment runs letter to letter; at the seam "!" shrinks to a speck over ~12 frames and
  "h" grows from a sliver. Stray DOTS trail the segment at stroke starts and corners (p 0.36, 0.43, 0.72, 0.87): a Travel speck defect,
  ledger 1.3, NOT touched (rod trailing clip in `viewport-3d.tsx`).
- **Changed:** `lib/stroke-schedule.ts` `windowAt` travel branch: `seamless` runs the head L to 1, so the segment is full length every frame.
  The viewport sets `seamless` only for travel + loop + no delay: patch `night-w/travel-loop-seam.viewport.patch` (Scene destructures
  `revealWindow: revealWindowParam`, one `useMemo`). APPLIED IN THIS CLONE'S WORKING FILE to film, NOT committed; the other lane's edits untouched.
- **After (`night-w/after/`):** travel 25% loop near-empty seam frames 13 -> 0 (min ink 55 -> 8298); 75% 8 -> 0; reverse loop 13 -> 0;
  inOut loop 22 -> 0. Controls unchanged: travel once 28/29 near-empty at the end (same), travel loop + delay 1 s 28 -> 28, grow loop 6 -> 6.
  **Seen:** "w!" holds to frame -1, frame 0 cuts to "he". No empty page, but a hard CUT from the end of the word to its start. His call.
- **Gates before (all green):** export-window 39/0, drawin-timing 25/25, take-timeline 20/0, timing-frames 30/0 (`night-w/gates-before/`).
- **NOT DONE, next exactly:** (1) gates after: `FS_PORT=3112 node scripts/verify/assert-export-window.mjs`, `assert-drawin-timing`,
  `assert-take-timeline`, `verify-timing-origin.mjs --label=nightw-after` then `assert-timing-frames --label=nightw-after`; diff rows against
  `night-w/gates-before/`. (2) open and grade the other before sheets: vanish, shrink, reverse, delay, the four eases, ones/twos (metrics
  exist, pictures not opened). (3) `assert-eye-draw-reads-written.mjs` not run. (4) `git apply --check` the patch on the main tree.

### F118 note, 2026-09-25 night, lane E (clone nightE): 20 looks graded, one copy line CHANGED. Still OPEN.
- **Grades:** `docs/verification/night-s/GRADES.md`, worst first, 8 to 28 of 100. Films in `night-s/film-f14/`, `film-fusion/` (Turn Table, Turn Table + Spin, Still Wet, Glitch Ribbon), `film-fusion2/` (Signal Ink, ASCII Rubber, Scanline Balloon, Pixel Clay, Code Bloom, Formation, Whole Cloth), full-res rest frames `night-s/fullres/`. The clone's runtime lacks lane C's lift holds.
- **Changed, `lib/style-system.ts` Turn Table description:** it said "hold still and it holds still", but picking it starts the turntable. Measured with `night-s/probe-turn.mjs`: no fusion, cameraSpin 0 and 0 px over 4 s; Turn Table, cameraSpin 12 and 84,993 to 112,520 px. The copy now says the pick starts it at 12 degrees a second. The "keeps working with motion off" clause was kept and NOT checked.
- **Not a bug here, for the renderer's owner:** Looping Stroke leaves round caps behind outside its window (film-f14/Looping-Stroke.png, t=3.66 and 4.88).
- **NOT DONE, exactly next:** the Layers panel's stack-preset row (`components/style-panel-scaffold.tsx` "Stack presets", about line 1712) still has no empty-stack line. Reuse the Presets panel's one: render `{presetStateGap("layerStack", styleState) && <p ...>{presetStateGap("layerStack", styleState)}</p>}` under the pills, copying the markup at line 3050; first check `presetStateGap` (lib/style-system.ts:5281) returns the empty-stack sentence for `layerStack` and not only `stackAnimation`, and if the empty line belongs to stackAnimation, put it under that row (~1697) too. Screenshot the Layers tab on a fresh page and open it. Stopped at 150k context.
### F118 lane T note, 2026-09-25 ~03:30: orphan caps and joint dots MEASURED, mechanism named, NO CODE CHANGED. Still OPEN. Retired at 150k.
- **Rig:** `docs/verification/night-t/orphan-probe.mjs` (lane W's word "hellow!", front view, :3112). For 31 playheads per case it grabs the frame
  and reads the window the scene USED (`__fsWindow.live()`). The expected region is [0,hi] minus [0,lo], both drawn under SHRINK through the same
  schedule path travel takes, dilated 10 px. A beat table maps each reference to its playhead; max reference window error 0.0004.
  DETACHED = outside ink in a component with no pixel in the expected region, which is what an orphan is. Two first runs were wrong and are
  not the record: grow as the reference (grow runs the pen-time law, travel runs the schedule) and `__revealHarness.windowAt(p)` (the scene
  feeds `windowAt` the pen-distance beat, not the playhead). `setFlatten({flat:1})` is refused; the flat key is `ink`.
- **Before (`night-t/before/summary.json`), detached px / blobs over 31 frames:** rod travel25 2073 / 28, rod vanish 2890 / 39,
  rod flat-ink travel25 2444 / 28, rod flat-ink vanish 3418 / 39, extrude 11 / 9 and 19 / 12 (single anti-alias pixels on trailing rims),
  solid 0 / 0 both, inflate vanish 0 / 0, inflate travel25 136707 / 31 (a separate defect, below).
- **Seen (sheets opened):** Rod: round dots on polyline CORNERS the segment has already left: the e's corners p0.40 to 0.46, the o's p0.73,
  the w's p0.88 to 0.91. Same as lane W's travel25-loop take (dots at p0.286, 0.357, 0.430, 0.722, 0.865) and lane E's Looping Stroke sheet
  (the N's top-left corner at t=3.66 and 13.41, its top and foot corners at 4.88 and 14.63): corners, not stroke ends. Extrude and Solid:
  no orphans; the only outside ink is a thin rim on the trailing cut face, attached to live ink.
- **Mechanism (Rod branch of the frame loop, `components/viewport-3d.tsx`, the `// --- Joints ---` block and the end-cap block after
  `hasVisibleSegment`):** joint `ji` is shown when `fracs[ji] <= distFrac` with NO lower bound, so every corner joint behind the window's
  trailing edge (`schedF0`, `ringStart`) stays drawn. The end cap is shown at `distFrac >= 0.98` without `hasVisibleSegment`, so a stroke whose
  tube has left the window can keep its end cap. `lib/flat-ink.ts` is not the cause: `makeFlatRenderer` draws one grow prefix and has no
  trailing edge; flat ink on `/` is a shader state on the same Rod meshes, and its counts track Rod's.
- **Found, NOT this lane's lines, NOT touched: Inflate under travel draws the wrong span.** At window [0.300, 0.550] it draws only the lower part
  of the first l, the same at 0.1, 0.6, 1.3 and 2.0 s (`night-t/inflate-check/inflate-p0.43.png`), so it is not lag. Its branch takes a draw range
  between two binary searches of `revealKeys`; whether that table is sorted in the travel beat is the first question.
- **NEXT, exactly:** (1) In the Rod branch, after `hasVisibleSegment`, add
  `const trailFrac = ringStart > 0 && ringFracs ? ringFracs[ringStart] : 0`; change the joint test to
  `ji < fracs.length && (fracs[ji] ?? 0) <= distFrac && (fracs[ji] ?? 0) >= trailFrac`; change the end cap test to
  `hasVisibleSegment && distFrac >= 0.98 && strokeMeshData.capPositions`. Grow is unchanged by construction (`ringStart` is 0 there).
  Write it as `night-t/orphan-caps.patch`, `git apply --check` it against HEAD and against the working file (lane W's hunk is in it). (2) Run
  `FS_PORT=3112 node docs/verification/night-t/orphan-probe.mjs after` and compare DETACHED per case; bar: Rod 0 blobs, others unchanged.
  (3) Re-film Looping Stroke with `night-s/film-presets.mjs` and lane W's travel25-loop. (4) Gates before AND after: assert-export-window,
  assert-take-timeline, assert-pentip-specks, assert-drawin-attrs, assert-eye-white-in-ink. None were run by this lane.

### F118 lane T2 note, 2026-09-25 ~04:30: Inflate's wrong span MEASURED and its mechanism named. NO CODE CHANGED. Job 1 NOT applied. Retired at 150k.
- **Inflate is wrong in EVERY window mode, grow included, not only travel.** Sheet `night-t/inflate-frames-before/rod-left-inflate-right.png`
  (opened; Rod on the left as the reference for where the window sits on "hellow!"): grow p0.43 Rod shows "hel", Inflate shows only "h";
  shrink p0.43 Rod "hell", Inflate "he"; vanish p0.43 Rod "low!", Inflate "w!"; travel p0.43 [0.300,0.550] Rod shows both l's, Inflate one
  piece of the first l; travel p0.25 and p0.7 draw a fragment. Rod travel in the same sheet shows the lane T orphan dots (e corners, o corners).
- **Mechanism, read off the page (`night-t/inflate-diag.mjs`, `inflate-poll.mjs`):** the Inflate mesh is REBUILT per playhead. Its index count
  moves with p (grow 0.30: 84,768; grow 0.55: 158,628; vanish 0.30: 186,900 = the whole word) and is stable over 6 s at one p, so it is not lag.
  The drawRange cut on top of it is hi of that clipped mesh (grow 0.43: 53,451 of 122,424 = 0.437, hi 0.443). Two reveals stacked:
  1. `inflateRevealsByDrawRange` (`components/viewport-3d.tsx` ~8321) is true only for `fusion === "implicit"`. `DEFAULT_INFLATE_PARAMS.fusion`
     is `"auto"` (`lib/geometry-engines.ts:1070`), so the flag is false, `useAnimatedStrokes` is true, and `animatedStrokes` feeds the builder a
     window-clipped copy (`filterStrokesByProgress` / `filterStrokesBySchedule`).
  2. `auto` routes this word to the implicit builder (`geometry-engines.ts:7746`, fold test), which writes `revealKeys` normalised to the
     CLIPPED strokes' own length (`capArc = acc / totalLen`, ~7306-7343). The frame loop's inflate branch (~6656) sees `revealKeys` and cuts a
     word-unit window [lo, hi] out of clip-unit keys. The keys ARE sorted (`isAscending` path, schedule identity, 9 tracks); sorting is not it.
  The probe's own reference (SHRINK through the same path) is broken the same way, so `orphan-probe` inflate rows are not trustworthy until this
  changes; its DETACHED metric also cannot see ink that is MISSING.
- **Proposed smallest change (not applied):** line ~8323, `fusion === "implicit"` to `(fusion === "implicit" || fusion === "auto")`. The existing
  `meshesCarryRevealKeys` effect flips it back off when auto picks the loft (the loft carries no keys; a build is all-implicit or all-loft,
  7829/7903), so a loft word keeps the rebuild path. Touches neither `lib/implicit-surface.ts` nor `lib/geometry-engines.ts`. It changes Inflate
  GROW too (the shipped default) and may change the hero beat if `/desk-doodles` builds Free Stroke Inflate with fusion auto: CHECK
  `HERO_INFLATE.fusion` (`lib/hero-motion.ts` ~1415) before filming. Rod, Extrude, Solid do not read the flag's inflate branch.
- **NEXT, exactly:** (1) gates BEFORE on the untouched tree (none run yet): assert-export-window, assert-take-timeline, assert-pentip-specks,
  assert-drawin-attrs with FS_PORT=3112; eye-white-in-ink runs on a hero film (`scripts/verify/film-hero-beat.mjs --label=night-t2-before`, 1,300 frames,
  one Chrome). (2) apply lane T's Rod fix (joints `>= trailFrac`, end cap `hasVisibleSegment &&`), pre-edit snapshot first; write
  `night-t/orphan-caps.patch` as a diff of only those hunks; `git apply --check` vs HEAD and vs the working file. (3) apply the flag change as
  `night-t/inflate-auto-drawrange.patch`, same checks. (4) `orphan-probe.mjs after`, `inflate-frames.mjs after`, open both; re-film Looping Stroke
  (copy `night-s/film-presets.mjs` from the main tree into night-t; it is not in this clone) and `night-w/film-windows.mjs ../night-t/wfilm-after
  travel25-loop`. (5) gates after, list moved rows. Server :3112 was started by lane T2 and stopped by exact pid at retire.

### F118 lane nightA2 note, 2026-09-25: lane A's three turn edits, each filmed and measured alone. All three KEPT. Changed, here is the film. Still OPEN until he watches it.
Films, headed, :3115: `hero-beat-film/night-a2-before` (clean f71f977e), `night-a2-grid`, `night-a2-blink`, `night-a2-after` (all three).
Evidence: `docs/verification/night-a2/` (gate outputs per arm under `gates/`, eye checks under `eye/`, sheets, `pair.mjs`, `at.mjs`, `widths.mjs`).
- **Grid, KEPT, 7792bf83.** `gridHelper` gets `renderOrder -1` and `depthWrite false`. white-in-ink A: emerge 25 of 82 red (worst excess 156)
  to 0 of 83 (53); returnTurn 23 of 76 (156) to 0 of 76 (25). Seen: at frame 630 the grid line down the "l" and across its top is gone
  (`grid-emerge-dles-before-over-grid.png`). Descend frames at matched playheads look the same (`grid-descend-matched.png`).
- **Blink, KEPT, 8edb488c.** `solidDepthAt` keeps `SOLID_EDGE_DEPTH` 0.5 near the edge (`max(cos^2, 0.5 sin^8)`); both dwells are the
  solid; the return dwell is flat 0, jointBreak 0. The edge pose goes from 0 px wide (blank page) to 8 px, one painted pose (about 0.09 s)
  on each turn. G stays 0 in emerge and returnTurn. assert-hero-transition MOMENT and SLIVER went red to green. The 75 deg solid pose now
  carries depth 0.38 (was 0.07) but the film never paints it at the default: poses are about 0.09 s apart.
  **Cost:** `assert-hero-return` "an object goes in and a DRAWING comes out, at the edge" went GREEN to RED (flip at model frame 15, edge 13).
  `assert-eye-letter-overlap` now reads 8 dwell frames per turn red at w 0.01: that is the sliver itself, read as stacked ink.
- **Lighter turn-in, KEPT, be62c486.** `solidShade`: shade + 0.28 (1 - depth)^4 on the solid only. Wash row
  39 vs 33 (red) to 34 vs 33 (green); all 7 transition controls still pass. Median ink luma at the 66 deg turn-in pose 54 to 48, the settled
  solid reads 49 to 50, so no overshoot. Measured on top of grid and blink, not alone against clean.
- **By-design reds unchanged:** "depth DEPARTS after the edge" red before and after; "sliver is REAL THICKNESS" red, depth at edge 0.004 to 0.502 (bar 0.99).
  "the drawing comes back CHANGED" was ALREADY red on the clean clone (K7 open false), not caused here.
- **Seen, not fixed:** a faint light nick near the top of the new sliver (`contact-edges-close.png`).
- **Not run on the final tree (stopped at the 150k line):** the model gates and all three eye checks on `night-a2-after`, and
  `assert-letter-seam` after (it was all PASS before). **Next, exactly:** run `assert-hero-return`, `-turn`, `-windup`, `-ledger` and
  `assert-eye-white-in-ink`, `-letter-overlap`, `-draw-reads-written` on `night-a2-after` with `--out=docs/verification/night-a2/eye/*-after`,
  diff rows against `gates/blink/` and `gates/before/`; check the shapes turnLands and solidFirst, which also use `solidDepthAt`.
### F118 note, 2026-09-25 ~03:20, lane "morning": both batteries, recaptures, the eye checks, one film. Still OPEN. Retired at the 150k line.
Clone of main at `03f3c1ee`, :3114, headed. Full table in STATUS "IF YOU JUST WOKE UP, 2026-09-25".
- Model 34/58, browser 48/59 (1 partial). After recapture 43/58 and 50/59, **93 of 117** against F115's 103 of 113.
- Bisected in sparse scratch worktrees: hero-turn `c391840e`; hero-return `c391840e` + `74b0b114`; hero-hold,
  hero-options, motion-paste `74b0b114`; stub-filter, nib-contrast `77a44826`. harness-surface `e5d40106`.
- Unknown: drawin-pentip `free-stroke-off` DECISIVE (0.1745 vs IQR 0.1992, 2 of 2 captures identical),
  closed-loops, hero-k7-news, pen-field-alloc, and the extra rows on hero-k7-intact and hero-transition.
- A fresh clone gives every file the same checkout time, so every stored-evidence gate reads PROVENANCE red
  and screen-layers picks the wrong label bare. Recapture in a clone before trusting any stored-evidence verdict.
- Evidence: `gate-integrity/model-battery-2026-09-25.log`, `browser-battery-2026-09-25.log`, `recapture-2026-09-25/`
  (`_index.txt`, `_grades.txt`), `eye-checks-2026-09-25/{0924,today}/`, film `hero-beat-film/morning-2026-09-25/`.

**Next step, exactly:**
1. The before/after mp4: 09-24 film (`~/Desktop/Projects/free-stroke/docs/verification/hero-beat-film/2026-09-24-look/film.mp4`,
   only in the main checkout, untracked) on top, `morning-2026-09-25/film.mp4` underneath, `ffmpeg -i top -i bottom
   -filter_complex vstack`, same crop, to `morning-2026-09-25/before-after-full.mp4`, plus a README naming the order (no drawtext here).
2. The still sheet `morning-2026-09-25/sheet.png`: draw end 0462, rest 0463, emerge ~0640, turn ~1100, hold ~1146, 09-24 over today. OPEN it and write what changed.
3. Bisect the four unknown browser reds: one sparse worktree without docs/, server on :3114 (stop the clone's first),
   at `c391840e^`, `c391840e`, `77a44826`, `74b0b114`, `78cc4f07`.

### F118 lane nightUI note, 2026-09-25 ~03:50: the draw-in controls now show in the Animation tab. Debug readout NOT done. Still OPEN. Retired at the 150k line.

**Changed, here are the screenshots:** `docs/verification/night-ui/before/` and `after/`, six each, from
`docs/verification/night-ui/probe-animation-tab.mjs` on :3117, headless, the lane's own Chrome.
- The Timing popover's body moved out of `components/viewport-3d.tsx` into
  `components/draw-in-timing-controls.tsx` (`DrawInTimingControls`, and `REVEAL_EASES` with it). The
  popover renders it, and so does the Animation tab (`components/style-panel-scaffold.tsx`,
  `AnimationControl`), one copy. `app/page.tsx` passes the same host state to both (`drawInTiming` prop).
- With nothing drawn the tab shows every control, enabled, under "How the draw-in plays" and the line
  "Nothing drawn yet. Set these now and your first stroke plays with them." Seen in
  `after/1512x982-1-animation-tab-nothing-drawn.png`: three columns (Draw in, Window with Delay, The form
  with Ease and Cadence), the rest below the fold of the drawer.
- `countDrawInUnits` exported from `viewport-3d.tsx` so both doors print the same count.
- An effect on `revealEase` re-derives the clock, so an ease picked in the drawer does not jump the mark.
- The Geometry card no longer says "open Draw-in timing"; it says where the controls are.

**3D view height, drawer open, Animation tab:** 1512x982 449 px before, 449 after; 1280x800 331 before,
331 after. Drawer closed: 890 and 708. F110 is no worse and no better. The drawer body now scrolls
1188 px of content in 414 (1512) and 350 (1280), was 800.

**Not done, the exact next step:**
1. The debug readout (`raw 0 pts | processed ...`) is still on `/` in dev. It is in
   `components/drawing-canvas.tsx:~481`, fenced only on `NODE_ENV === "development"`. Next step: gate it on
   `process.env.NODE_ENV !== "production" && ?debug in the URL` (read in an effect, no hydration mismatch),
   then re-run the probe with and without `--debug` (the probe reports `readoutOnPage`).
2. Open the other five after screenshots; only `after/1512x982-1-...` was opened.
3. Gates not run: `assert-debug-surface-fenced`, `assert-no-em-dashes`, `assert-take-timeline`,
   `assert-harness-surface`.
4. Seen before, not in scope, still open: with the drawer open the Timing popover is clipped at the
   drawer's bottom edge (its title and Order row hidden) at both sizes; at 1280 the transport's Debug
   button is cut by the right edge.
### F118 lane nightG note, 2026-09-25: the grey "hairlines" in tilt, standup, orbit and descend MEASURED. They are the solid's own lit flank. NO CODE CHANGED. Still OPEN until he watches it.
Clone of main at `4a5b840de`, :3116, headed. Film `hero-beat-film/night-g-before/`. Evidence `docs/verification/night-g/`.
- **G on the film, clean tree:** tilt 15 of 18 red (worst 63 px at 0798), standup 105 of 129 (113 at 0806), orbit 86 of 86 (36),
  descend 10 of 41 (39 at 1016). Every other phase 0 red on G. Same picture as the morning film.
- **Seen at 3x** (`before-standup-0806-l-3x.png`, `before-standup-0806-D-3x.png`, `before-tilt-0798-l-3x.png`,
  `before-orbit-0928-e-4x.png`, `before-descend-1016-3x.png`): the red sits on the outer 1 to 2 px of a tube's LIT flank, the right side
  of the "l" stems and the top rims of D, e, s. No second copy of any edge, no paper between. The luminance across the "l" at 0806 runs
  69 72 76 ... 136 154 175 then 229 246 paper: one smooth ramp from the dark core to the silhouette. The 09-24 ghost at 1115 reads
  250 229 130 227 250 250 250 250 220 49: a 1 px grey line with paper on both sides, 5 px off the ink. Different thing.
- **Splitter** (`split-g.mjs`, G itself untouched): each G pixel walks the straight line to its nearest solid ink; any pixel at 215 or
  lighter on that line (page 243-250, darkest grid line 216) is paper between, DETACHED, else ATTACHED. Controls: synthetic lit tube 360
  attached 0 detached; plus a grey line 4 px off, 120 detached. 09-24 film (`f118-turn-before`) at 1108-1115: 256 detached px per frame.
  A ghost planted on real frame 0806: 23 of 23 px read detached, the flank stays 113 attached (`plant-control.txt`). A flood fill was
  tried first and was wrong (it crawled along the ghost from where it touches the letter); replaced before the film was read.
- **This film: 10,271 G px across tilt, standup, orbit and descend, 10,271 attached, 0 detached** (`split-g-before.txt`).
- **OFAT on the live page, one change per arm, applied inside `renderer.render`** (`probe-ofat.mjs`, `ofat/`, playheads 8.31 8.40 9.00
  9.90 10.68; the clean arm reproduces the film, 112 vs 113 at the standup worst): unlit `MeshBasicMaterial` 0 at every playhead; scene
  environment off 0 to 6; directional and point lights off 14 to 66; ambient and hemisphere only, no environment, 0. No change from
  specular 0, sheen 0, clearcoat 0, roughness 1, `penCarve 0`, `jointBreak 0`. Scene inventory: one ink mesh (MeshPhysicalMaterial),
  one white quad, the grid. No outline mesh, no back-face shell, no post pass. Sheet: `ofat-standup-8.40-l-clean-noEnv-lightsOff-basic.png`,
  unlit is a flat black silhouette with no grey edge; with the environment off only the key-lit "l" flank keeps its grey.
- **Mechanism, in plain words:** the environment light plus the key light lift the tube's flanks and rims above lum 128 for more than
  1 px before the silhouette. G calls anything under 200 and at least 2 px from lum-128 ink a hairline, so it counts the lit side of a
  round tube. That is real shading, not ghosting, not the carve, not anti-aliasing. **The reds are the instrument, not the picture.**
  G was not loosened. The honest reading for 3D phases is the DETACHED count, which is 0 on this film.
- **Not changed, so no after film and no gate rows moved.** Only `assert-eye-white-in-ink` was run. `assert-hero-transition`,
  `-letter-seam`, `-ledger`, `-letter-overlap` and `-draw-reads-written` were not run: nothing to compare against.
- **Seen, not judged:** a thin light streak inside each "e" loop and where tube meets tube in the standup frames, the A instrument's
  territory (A read under its bar there). If the lit flank itself looks wrong to him, that is a material/lighting call, not a defect fix.
- **Next, exactly:** his eye on `night-g-before/film.mp4` 8.3 to 11.0 s. If he wants the G column trustworthy in 3D, the controller
  decides whether the detached split goes into `assert-eye-white-in-ink` G for the solid phases (a gate change, not this lane's).

### F118 lane nightU note, 2026-09-25: the six UNKNOWN reds traced. No regression found, no product line changed. Still OPEN: four gates to re-derive, his call.
Clone of main at `7dd08abb4`, :3119, headless, every gate run alone. Table: `docs/verification/night-u/UNKNOWNS.md`.
- `hero-transition` is GREEN on main, 16/16. The turn fixes `8edb488c6` and `be62c486f` took the morning's 3 reds.
- One knob on main, the old trace swapped back into `scripts/capture/logo-strokes.json` and then restored: `closed-loops`,
  `hero-k7-news`, `pen-field-alloc` go GREEN and `drawin-pentip` DECISIVE passes. All four flipped on the retrace `77a44826b`.
- `hero-k7-intact`'s new 4th red is `74b0b1147` (`ret` changed to identical): the live beat no longer opens the break, by design.
- `pen-field-alloc` is an instrument problem: its 4 "specks" are a grid line at luma 203 under an ink cut of 205, in the
  un-carved frame too. The carve splits nothing.
- **Gates to re-derive, never edited here:** `assert-closed-loops.mjs:72` (old stroke-index gaps), `assert-hero-k7-news`
  (one break = one gap; also tests a channel the live beat no longer uses), `assert-hero-k7-intact` live-beat row,
  `assert-pen-field-alloc` speck test (threshold vs grid; compare against un-carved), `assert-drawin-pentip` parked-prior
  calibration on the 12-stroke word.
- **Next step, exactly:** his word on each re-derive. Before that, if wanted: run `probe-pen-field-specks.mjs` with the old
  trace swapped in to measure the grid line there, and bisect `8edb488c6` against `be62c486f` for `hero-transition`.

### F118 lane LOOKS note, 2026-09-25: the fusion dither CHANGED, here is the film. Still OPEN until he watches it.
Plan: `docs/research-2026-09-25/looks/PLAN.md` ranks 1 and 2.
- **Rank 2.** `docs/verification/night-s/film-presets.mjs` now films each fusion in the first of its own `bestModes`, read from `lib/style-system.ts` (refuses if none is found). `FS_FORCE_MODE=solid` reproduces the old sheets. Signal Ink films in rod, Pixel Clay in solid, Glitch Ribbon and Code Bloom in extrude, Scanline Balloon in inflate.
- **Rank 1.** `lib/dither-shader.ts`: object lock now means a shading dither. The threshold offset is masked by `1 - smoothstep(0.3, 0.6, fsNdV)`, the ink end is 0.4 of the body tint, and a flat rim at 0.2 of the tint covers `fsNdV < 0.22`. Object lock also projects onto the plane of the dominant object normal. Screen lock is exact: every `mix` weight is 0, so all 21 screen-locked dither presets, Code Bloom among them, take the old math. Signal Ink and Pixel Clay moved to IGN, Glitch Ribbon kept bayer4. All three are now 3 levels, object lock, scale 0.7 (object units, about 2 px cells at the probe's view; scale 2 measured about 6 px).
- **Legibility, paired against the same pose with dither off** (checker = std(A-B) over the letter's own contrast, legible at checker <= 0.25 and edge >= 0.8). Before to after: Signal Ink 0.417 to 0.195, legible. Pixel Clay 0.530 to 0.124, legible. Glitch Ribbon 0.616 to 0.295, still fails. Code Bloom 0.242 to 0.267 with no code change, and Scanline Balloon (no dither) 0.043 to 0.093, so run-to-run noise is about 0.05 and the bar sits inside Code Bloom's noise. Coverage reads 1.0 everywhere, so it cannot tell looks apart.
- **Still wrong.** Glitch Ribbon's letters are now covered in ASCII glyph columns (not dither, and outside this lane). Signal Ink's pattern is nearly gone on the thin rod, so its "pattern floods back" idea is hard to see. Pixel Clay keeps a coarse checker on up-facing faces during the chunk driver. The gates-after run was stopped at 1 of 24 when the lane hit its context line; the gates have not been re-run on this change.
- Film: `docs/verification/looks/before/` and `after/` (sheet, `-pair`, `-turn` per look, `report.json`).

### F118 lane LOOKS-2 note, 2026-09-25: the 24 dither gates on aae7b2f20 move nothing, and 5 of the 7 reds never looked at the new shader. Still OPEN until he looks at the three sheets.
- **Gates.** All 24 `scripts/verify/assert-*.mjs` that mention dither (case-insensitive grep, 24 files) ran one at a time on aae7b2f20, headless, dev server :3136. 17 of 24 pass, 7 of 24 fail, the same 17 and 7 as main. Logs: `docs/verification/looks/gates-after/`.
- **Before, rerun.** The 7 reds reran on main's shader in a worktree at c0407f58b, the parent of aae7b2f20 (bc9ae5c7b is not in this clone, and the only product diff between the two trees is `lib/dither-shader.ts` and `lib/style-system.ts`). Every red count matches: data-safety 4 of 134 (rows 3.1 x2, its 3.1 control, 3.3; strokes read `null`), pentip-specks 4 of 38, stack 1 of 12, stack-anim 1 of 10, fusion-two-dead 1 of 1, timing-frames 1 of 1, screen-layers refused (no `sweep` capture). No row moved. Logs: `gates-before/`.
- **What the reds are made of.** 5 of the 7 (fusion-two-dead, pentip-specks, stack, stack-anim, timing-frames) fail only on PROVENANCE: they grade stored frames, and the frames are older by mtime than `lib/dither-shader.ts`. On the fresh worktree the gap reads "STALE BY 0.0h" and still fails. None of the 5 rendered the new shader, so their pass rows say nothing about aae7b2f20. 13 of 24 gates launched a browser on this run; 11 did not.
- **Sheets, 1:1 pixels, same crop and pose in every column, before | after | dither off, rest (orbit 45) and mid-turn (orbit 105):** `docs/verification/looks/for-him-signal-ink.png`, `for-him-pixel-clay.png`, `for-him-glitch-ribbon.png`. Raw frames in `trio-before/` and `trio-after/`, built by `capture-trio.mjs` and `compose-trio.mjs`. Control: dither-off frames match across the two trees at 0 px for Pixel Clay and Glitch Ribbon, but differ by 28,327 px (rest) for Signal Ink, so Signal Ink's off column is not a pixel-exact control.
- **Signal Ink has gone plain.** Before: black and cyan bar-code bands down every rod. After: plain light cyan glass rods with a thin dark edge; only a rod near edge-on at mid-turn picks up a grey blue-noise mottle. Nothing reads as signal.
- **Pixel Clay reads as pixel, but the texture does it.** Before: a coarse black and cream checker that swallows the letters. After: tan clay with a fine pixel mosaic that is also there with dither off; the dither mostly lightens it and adds glints. At mid-turn one up-facing face on the X carries a clean diagonal checker of about 8 px cells, which no other face has.
- **Glitch Ribbon reads striped, less glitch.** Before: dense cyan and black checker everywhere. After: slate body with vertical dashed ASCII columns (also there with dither off) plus fine checker patches on faces turned to the camera. The glitch read now comes from the ASCII layer.
- tsc 6 errors, the baseline. No product code or gate changed.

### F118 lane ANIM-1A note, 2026-09-25: per-stroke timing is in the model, Node only. Not wired into `/` yet. Still OPEN.

His ruling (`docs/rulings/2026-09-25-animation-comes-back.md`) brings back per-stroke speed, ease, delay and hold back. Phase 1a of `docs/research-2026-09-25/animation-tools/DESIGN.md` is built as a model with no UI and no viewport change:

- `lib/stroke-timing.ts` (new): `StrokeTiming` rows, a take with "Ripple later strokes" (default off, which keeps every other stroke put like After Effects layers), `buildTimedSchedule` (null with no rows), `timedRevealKeys` (each triangle keyed by its arrival time on the take's clock), `timedTipMap`, and `sampleTake(timed, clockMs)` for export.
- `lib/pen-reveal.ts`: `buildTipField` takes an optional timed map and returns a third channel, `slope`, one float per texel. Absent on every other path.
- `lib/stroke-schedule.ts`: comments only. The "two clocks" lines are struck, citing the ruling.
- `node scripts/verify/assert-stroke-timing.mjs`: 16 of 16 rows pass, 12 of 12 mutants caught. No rows is byte-identical to b0da66626 on 24 of 24 fixture x schedule cases (hero plus 5 SHAPES, 4 schedules each). Only the hero and `square` carry Inflate reveal keys in Node; the other 4 SHAPES cover tip field, coefficients and windows only.

Not run, all browser: the viewport does not read any of this yet (beat := clock under a timed take, the shader reading `slope` in place of `ts.scale`, the doc-store field, `window.__fsTake`). Those are the rest of phase 1a and touch `components/viewport-3d.tsx`, which this lane did not own.

### F119 · Rod leaks its tube geometry on every rebuild (found 2026-09-25, lane TRAVEL-7)

Every switch back to Rod leaves 12 geometries and 48 GL buffers behind, on every tree, including one with
no loop-wrap code (a4465d637). Nothing disposes the tube geometry a rebuild replaces. It grew in a straight
line over 6 flips in a 60 s memory probe (`scripts/verify/_probe-memory-leak.mjs --scenario=travel` on
`lane/travel`, data in `docs/verification/travel/memory-t7/` there); 60 s cannot rule out a bounded cache.
Open. Needs: find the rebuild that drops the old geometry without `dispose()`, fix it, prove it with the
probe (flat geometries across 20 flips), and a must-fail that skips the dispose.
#### F119 note, 2026-09-25, lane LEAK (`lane/leak`). MERGE-READY.
Cause: `useStrokeMeshes` (components/viewport-3d.tsx:597, called at :9311) builds a fresh Rod tube per
stroke and nothing freed the set it replaced. 12 strokes in the hero word, 4 buffers a tube: 12 and 48.
Fix, :9331 to :9367: after each build, dispose the `mode === "rod"` tubes that are not in the new set, and
all of them on unmount. Inflate is left alone because its implicit slot reuses one geometry across builds.
Caps and joints are shared spheres and are never in that list. Evidence: `docs/verification/leak/`.
- Before, 20 flips Rod and Inflate: geometries 37 to 157, live GL buffers 134 to 614, +12 and +48 every
  return to Rod, on both `--scenario=travel` and the new plain `--scenario=flip` (no window, no Play).
- After, the same 20 flips: Rod returns hold at 37 and 134, Inflate at 25 and 86. The probe now exits 0.
  Travel wobbles by 1 buffer and never climbs.
- Must-fail `--skip-dispose=1` (the viewport skips the dispose): 49 to 157, 182 to 614, exit 4 LEAK.
- `assert-take-timeline` 20 PASS before and after. `assert-export-window` 39 PASS before and after.
  Rod stills from `film-loop.mjs --stills=1`: 16 of 16 PNGs byte-identical (cmp), 0 px in `--compare`.
- tsc: 6 errors, same as the baseline.
- Probe exits (controller's Codex note): 1 when the scenario throws, 2 when blind, 3 on a watchdog kill,
  4 on a leak, 5 when a Play click fails or Travel stops playing after a flip, 6 when `isPlaying` is null.
  Each has a must-fail that fired, logs in `docs/verification/leak/exits/`. After a flip the transport
  keeps playing, so Play is absent and that click almost never runs; exit 5's standing check is that
  Travel is still playing after the flip.
### F118 TRAVEL note, 2026-09-25: TRAVEL-4 changed the Solid seam and the stats readers. Still OPEN.
Solid seam share now 14.6 to 14.5 (was 14.5 to 22.1), but the in-pass max step rose from 0.015 to 0.092:
the pop moved to about 0.012 after each seam, where 8 thin rods appear at once (+3 points). GLB mid-wrap
on Rod equals unwrapped, 29792 triangles. Step 3 consumers and the after gates are not done. Detail and
numbers: docs/verification/travel/LOG.md, TRAVEL-4 entry. Commits 00aad3a9e, 6ac670808.
### F118 lane ANIM-1A5 note, 2026-09-25: NOT MERGE-READY. Rod passes rows 1 to 4 and 6b/6c; Inflate's timed path does not match its shipped path under neutral rows. Stopped at the 150k context line.
- **Blocks merge, Rod:** 6a (identity against 1051bc8e1) NOT RUN, no base file yet. Baselines (step 5) NOT RUN on this head.
- **Blocks merge, Inflate:** rows 1 to 5 FAIL, and the profile below says the cause is the render, not only the gate.
- **Changed in `components/viewport-3d.tsx` (918f858a9):** under a timed take at `grow` over the identity schedule, Rod keeps its own per-stroke path and is handed a per-stroke pen time (`timedRodMs`): take time maps back through the row (inside the slot through its ease, outside by a shift). A stroke the rows did not move gets `currentTimeMs` itself. Measured cause: with twelve neutral rows Rod read `sampleTake` spans and at playhead 0 drew stroke 0 with 0 indices where the shipped path draws 96 (the MIN_REVEAL_RINGS stub). Travel windows and reordered schedules keep the spans.
- **Rod, measured on :3138:** 6b 25/25 (was 24/25, p0 s0 96->0). 6c positive control PASS: 1 ms delay on every row at 6752.04 ms, a render-found ring step, reach 0.52 vs 0.51. Row 1 speed 0.010 (knockout 0.380). Row 2 delay 0.000 (knockout ink 0.130). Row 3 hold back PASS: first ink 13128.2, want 13128.3, take grew 1767.6 ms for a 1767.7 ms slot read off the render (knockout midpoint ink 0.510). Row 4 ease PASS 0.000 (knockout 0.410). Row 5 NOT APPLICABLE on Rod, not counted.
- **Slot from the render (gate, 45dbb7a04):** B0 = 2·h2 - h from the speed-2 half-reach instant; length = 2 × the ripple shift of stroke 6 at speed 2. Neither reads `get().slots`.
- **Inflate instrument:** per-stroke pixel masks (ink in the finished frame, background with only that stroke held back 5 s). R0 PASS, 12 masks, smallest 511 px, stroke 5 box 267,343..434,414 (1396 px).
- **Inflate finding, `--profile`:** stroke 5's reach under twelve neutral rows runs up to 0.094 ahead of no rows from 6975 to 7475 ms, and a 400 ms delay does not move that part: the extra ink is anchored to the clock, not to stroke 5. Seen in the 7125 ms frames: no rows shows the top of the D's stem as an open cut; neutral rows show it closed and rounded, 136 px differ, all at the stem top where the bowl returns. Next: find which key or tip-field texel owns that region under `timedArc` / `timedTipMap` versus `scheduleArc`.

### F118 lane ANIM-1A6 note, 2026-09-25: NOT MERGE-READY. Inflate rows 1, 2 and 3 fail on the gate's own expectation and mask, 6a is not run, and step 4 baselines are not run. Stopped at the 150k context line.
- Rebased onto main 466d1e7bd (loop-wrap merge plus the Codex crosscheck). Conflicts in `components/viewport-3d.tsx` kept both: `wrapIndex` / `schedSpansTail` / `wrapOn` and the timed path; the shader's trailing edge keeps the wrap's max/min and divides by the slope. `docs/RUN-QUEUE.md` kept both sides. tsc 6, `assert-stroke-timing.mjs` 16 of 16 with 12 of 12 mutants.
- Inflate's early stem top was the CULL. Neither the triangle keys (ascending before and after the map; bypassing the sort changed nothing) nor the tip field's resolve (moving its return-pass gap to raw arc changed no profile point). The break: the timed drawRange margin forced from `slopeMax` to slope 1 moved the region from 400 ms early to 50 ms late (neutral 0.938 vs none 0.994 at 7525 ms). Changed: `timedFront` in `lib/stroke-timing.ts` walks the nib margin in arc per stroke; residual with it was 17 of 43 profile points off by at most 0.006. Changed: `TimedSchedule.identity`, and an identity take draws through the shipped path. Neutral rows now 43 of 43 profile points and 25 of 25 frames equal to no rows (6b); 6c positive control fires.
- Inflate graded: 4 ease PASS (0.0115, knockout 0.3603), 5 nose at speed 2 PASS (5 px, slope knockout 58 px, bar 40), 7 export PASS. 1 speed FAIL 0.0831: the row samples at s + u·d/2 from first ink, and on Inflate first ink sits 83 ms after the render's B0, so the want is late by that much; expected T = B0 + (s + u·d - B0)/2. 2 delay and 3 hold back FAIL at the same 0.0595: stroke 6's ink inside stroke 5's mask once stroke 5 is moved past stroke 6's start (the o meets the D). Neither is read as a product fault until the gate is corrected and re-run.

### F118 lane ANIM-1C note, 2026-09-25: NOT MERGE-READY. Extrude is wired and passes 9 of 9 rows. Solid is NOT WIRED: its frames break under the timed clip. The full four-engine run and the step 3 baselines were NOT RUN. Stopped at the context line.
- **What blocks it.** (1) Solid. (2) Nobody has run Rod and Inflate on this head, or take-timeline, drawin-timing, export-window and stroke-schedule. A skipped check is not a passed one.
- **Changed.** `lib/stroke-schedule.ts`: `filterStrokesBySpans(strokes, parts)` is the clip, handed spans. `filterStrokesBySchedule` now calls it with the spans it always computed. The one-window loop tested `f1 <= f0` and now tests `f1 > f0`; the two differ only on a NaN span. `lib/stroke-timing.ts`: `takeSpansIn(ts, win)` runs `sampleTake` for each part in `windowParts`. `components/viewport-3d.tsx` (Scene): under a non-identity timed take on Extrude, the window is `windowAt` of the playhead (the take's clock, as Rod reads it) and the clip is `filterStrokesBySpans(strokes, takeSpansIn(...))`. An identity take keeps the shipped clip. The tick's skip-same-frac is OFF under that clip, because a held stroke moves while the beat sits still in a pen lift. `useTimeline` and the `timed` memo moved up, unchanged, above `animatedStrokes`: reading them below would be a TDZ error, and a ref would hand over last render's take. tsc 6, none added.
- **Extrude, measured** (`docs/verification/stroke-timing/anim1c-extrude-solid-run1.log`, extrude and solid both wired at the time): R0 PASS (12 masks, smallest 373 px). 1 speed 0.0011 (knockout 0.3471). 2 delay 0.0011, ink at s+200 0.000 (knockout 0.173). 3 hold back first ink 13141.7 against 13141.5 wanted, take grew 1767.6 ms for a 1767.4 ms slot (knockout 0.524 at its midpoint). 4 ease 0.0000 (knockout 0.3917). 6a 25/25 against 57a97b4d1. 6b 25/25. 6c positive control PASS. 7 export 122/122 twice (knockout 9/107). Before arm, same gate on 57a97b4d1's product code: R0 FAIL, every mask empty, on both engines (`anim1c-before-57a97b4d1.log`).
- **Solid, measured, not fixed.** With Solid wired, R0 failed: masks 7 to 11 were EMPTY. `anim1c-solid-held-alone.png`: with stroke 6 held back, the frame showed "Desk D" and dropped every stroke after 6. With stroke 7 held back it showed "Desk Do". With stroke 7 alone and whole and every other stroke held back, the frame was empty. Stroke 6 alone draws. Extrude drew the same spans correctly. So Solid's build loses everything after an empty stroke in the middle of the list. My guess, not checked: Solid reads the partial by position or as a prefix. The next step is to find that reader in Solid's build (`useStrokeMeshes` to `buildMaskSolid`) and check whether a reordered `drawIn` schedule on main breaks the same way. After that, flip `timedClip` to include `"solid"` and run with `--grade-solid`.
- **Where the Solid tick tolerance goes, not yet applied.** `SolidAnimationTick` syncs at most once every 22 ms (`now - lastSyncTimeRef.current >= 22`), so the tolerance is 22 ms. On a paused seek with the gate's 280 ms settle, that interval has always passed, so rows 1 to 4 read an exact frame. The tolerance applies to row 7, where the export settles only 2 rAFs after each seek. Extrude uses the same tick and did not need it: 122/122.
- **Gate.** One base file per head: `--phase=base --base=<sha>` merges engines into `base-<sha>.json`, and refuses a file grabbed at another penMs. The Extrude and Solid base (`base-57a97b4d1.json`) was grabbed twice, byte-equal: Extrude has 25 distinct frames, Solid 17. Extrude reads reach off the same pixel masks as Inflate (on Extrude a drawRange is the whole rebuilt mesh). Row 5 is NOT APPLICABLE on Extrude and Solid, since neither draws a tip. Solid prints NOT WIRED and is not counted.
- Commits on `lane/anim1c`: ade10f7ba (base), 2f85a3d90 (wiring and gate), then this note. Dev server :3139 (npx 78916, node 78944, cwd this clone), killed by exact pid.

### F118 lane ANIM-1C2 note, 2026-09-25: NOT MERGE-READY. Solid is still NOT WIRED. The cause is found, and it is not the one ANIM-1C guessed. Stopped at the context line before any fix.
- **What blocks it.** No fix, no Solid wiring, no `--grade-solid` run, no four-engine run, no baselines. Every one of those is NOT RUN.
- **The cause, measured.** Solid does not lose strokes after an empty entry. It loses every stroke whose ink sits past the right edge of the canvas it rasterizes. The gate injects the raw `logo-strokes.json` polylines, and in the browser they span x 7 to 1089 px (`anim1c2-probe-summary.json`), while Scene hands Solid `canvasWidth = innerWidth / 2 = 720`. `renderStrokeToMask` (`lib/solid-mask.ts:3700`) rasterizes only `[0, canvasWidth] x [0, canvasHeight]`, so strokes 7 to 11 (x from 734 up) land off the mask and build nothing. Extrude builds from the points and never rasterizes, which is why it drew the same spans.
- **The proof.** A probe dumped the exact partial list Scene hands Solid under the gate's own takes (Solid wired in `timedClip` for the probe only, then reverted). Held-6: 11 entries, no empty one (`filterStrokesBySpans` drops a held stroke, it does not leave a hole). Fed to Node's `SolidEngine.buildPreview` at 720x852, entries 0 to 5 build 1648, 1520, 1552, 840, 800 and 1600 verts alone, and entries 6 to 10 (strokes 7 to 11) build 0. Stroke 6 alone builds 1440, stroke 7 alone builds 0. The browser's WHOLE list on Solid in Node ends at world x 1.21, the end of stroke 6, so the full frame is missing strokes 7 to 11 too, which is why masks 7 to 11 read EMPTY in ANIM-1C's R0. Frames: `anim1c2-probe-held6.png` (Desk D), `anim1c2-probe-alone7.png` (empty).
- **The empty-entry question, answered no.** `scripts/verify/solid-bench/gaps.mjs` builds the hero at the bench canvas (650x802, fitted to 90 %) with stroke 6 dropped, empty, one point, a zero-length piece, and stroke 7 alone, on Solid and Extrude, in the anim, static and no-holes paths. 14 of 14 rows pass in each of the three, so no reader in the cluster step, `mergeSolidResults` or `buildMaskSolid` treats the list as a prefix. Caveat: gaps.mjs has no must-fail arm yet, so it has only ever passed. The next lane adds one: grade a stroke placed past x = CW, which must FAIL.
- **Step 2, main.** Not checked in the browser. By the mechanism, a reordered schedule on main cannot cause this: the loss is by position on the canvas, not position in the list. Whether real drawings can put ink past `innerWidth / 2` (the draw panel is that wide) is the question for main, NOT CHECKED.
- **Next step.** Decide which is wrong: the gate's fixture (fit the injected polylines to the 720 px panel, which is a gate edit and needs his call), or Solid (raster the pool's own bounds). Then wire Solid in `timedClip`, run `--grade-solid` with the 22 ms tolerance on row 7, the four engines and the baselines.
- Commits on `lane/anim1c`: this note and `gaps.mjs`. `components/viewport-3d.tsx` is unchanged from 033b0bdeb. Dev server :3139 (npm 11778, next 11794, node 11796, cwd this clone), killed by exact pid.

### F118 lane ANIM-1C3 note, 2026-09-25: NOT MERGE-READY. The Solid raster fix holds and Solid is wired, but two Solid rows fail, export-window reads 38/39, and main's live exposure was tested on this head only. Stopped at the context line.
- **What blocks it.** (1) `solid 4` ease: got 0.072 against a want of 0.101 at one sample (the other three match), worst 0.0292 over a 0.02 bar. Not diagnosed. (2) `solid 6a`: 1/25 against the 57a97b4d1 file. Expected, and the gate is not wrong: those base frames were recorded while Solid dropped strokes 7 to 11 and clipped stroke 0's left cap, so every inked frame now differs. Needs his call: re-record Solid's 6a base at e3fad1f02 (fix, no wiring), which is a change to the gate's reference. `solid 6b` (neutral rows = no rows) is 25/25 on this head. (3) `assert-export-window` 38/39, one FAIL on the KNOWN-BAD row ("the call site as it stands TODAY still writes the blank hold"). Not compared against 43bf2856c, so not yet known whether this lane caused it. (4) Step 3 on main NOT RUN in the browser.
- **The fix** (`lib/solid-mask.ts`, e3fad1f02). `renderStrokeToMask` rasterizes union(canvas, ink bounds padded by half the line width + 2 px). The frame grows by the same mask px on both sides, so the mask centre stays the world origin and mask px per canvas px is unchanged; `buildMaskSolid` maps back with the base dims, and the counter re-raster shares the frame. Pad 0 is the old arithmetic.
- **Identity, measured with `solid-bench/bench.mjs --against` a 43bf2856c run.** hero anim 120/120, hero static 120/120, o anim 120/120, o static 120/120. SHAPES 1 of 5 in both: the 4 that differ are the fixtures whose ink runs past the bench canvas's right edge (crossing to mask x 698 of 512, pad 99; circle and ring pad 12; square pad 5). The one inside (tick, pad 0) is identical. A probe logged pad 0 on all 221 hero builds. Selftest 5 of 5.
- **gaps.mjs must-fail.** Stroke 6 moved past x = CW: FAILS on 43bf2856c (0 verts alone, coverage 0.00), passes after. Hero at 720x852 raw: on 43bf2856c strokes 7 to 11 build 0 verts each; after, all 12 build (anim 848 to 1312, static 688 to 1704). anim, static and no-holes all exit 0 after, exit 1 before. Extrude control 0 misses throughout.
- **Main's exposure, this head only.** Real mouse strokes at 1440x900 (panel 719.5 px), B at x 576 to 698, then the window shrunk to 1000 (innerWidth / 2 = 500): the stored points keep their px, so B sits past the canvas Solid is handed. Solid's span over Extrude's is 1.003 after the shrink, so B builds here (`anim1c3-exposure-head.json`). main's `lib/solid-mask.ts` is byte-identical to 43bf2856c, and the Node rows prove that raster builds 0 verts for ink past the canvas, so main very likely drops B after a shrink. That is inferred, NOT measured in the browser on main.
- **`--grade-solid`, four engines** (`anim1c3-grade-solid.log`): 36 PASS, 2 FAIL (both above). Solid R0, 1, 2, 3, 6b, 6c, 7 pass; row 7 matched 122/122 exact, so the 22 ms tolerance did no work (within-tick count 0, knockout 9/107). Rod, Inflate, Extrude all pass. Without the flag Solid now prints NOT GRADED instead of NOT WIRED.
- **Baselines on this head.** take-timeline 20/20. drawin-timing 24/25, the CONTROL row (F108 flake). export-window 38/39 (above). stroke-schedule 57/60; three FAIL rows are the window set subtraction, the leading edge and the reverse remap-after row; not diffed against the old list. tsc 6 errors, the baseline.
- **Next step.** Diagnose `solid 4` at the 0.101 sample; get his call on re-recording Solid's 6a base; run export-window on 43bf2856c to see whether the KNOWN-BAD row predates this lane; run `exposure.mjs` (the probe, in the lane scratchpad; copy it in) against a sparse base of main.
- Commits on `lane/anim1c`: e3fad1f02 (fix + gaps rows), 27fc71db3 (wiring + gate tolerance + log), this note. Dev server :3139 (npx 29763, next 29790, cwd this clone), killed by exact pid. Sparse base removed.

### F118 lane ANIM-1C4 note, 2026-09-25: NOT MERGE-READY. solid 4 still fails, on a second cause the first fix uncovered. Baselines not run: the lane hit its context line.
- **What blocks it.** (1) `solid 4` ease: 0.0674 over the 0.02 bar, want 0.000,0.101,0.217,0.467 got 0.067,0.102,0.217,0.465 (`anim1c4-grade-solid.log`). The 0.4 sample is fixed; the 0.2 sample is the new miss. (2) take-timeline, drawin-timing, export-window on this head, stroke-schedule and stroke-strip NOT RUN.
- **solid 4, cause one: the product, fixed (94734ef3f).** Not the rebuild tick: the ease frame reads the same after 1.5 s more and on a second seek (0 px). `filterStrokesBySpans` tags every piece with `clipArc`, and Solid's raster strokes a piece shorter than the line at that arc; no rows cuts with `filterStrokesByProgress`, which tags nothing. Before: the ease frame matched no no-rows frame within 60 ms either side (162 px or more, all inside stroke 5's box). After: it is byte-equal to the no-rows frame 1 ms from the gate's instant (`solid-bench/ease-sample.mjs`). The timed branch in `viewport-3d.tsx` now drops the tag when the untimed path would call `filterStrokesByProgress` (identity schedule, grow window). Extrude reads no `clipArc`, so only Solid moves. Knockout still fires (0.4034).
- **solid 4, cause two: open.** At u 0.2 the eased instant is base 5900.7 ms: inside stroke 5's slot (B0 5890.4) and before its first ink (5904.2). `sampleTake` already gives the stroke a sliver there, and the shipped path gives it nothing. The `clipArc` dot hid the sliver; at full width it is 0.067 of the mask. Next step: compare `sampleTake`'s reach with `revealDistanceFraction` over the slot's first 15 ms, in Node. To go back to the old numbers, revert the viewport hunk of 94734ef3f.
- **solid 6a, his ruling.** The base is now `base-62358b9ff.json`, the raster fix before the wiring, grabbed twice, byte-equal (sha 77737fbecd841800). 1 of its 25 frames matches the 57a97b4d1 file, which held strokes 7 to 11 dropped and stroke 0's cap clipped. 6a 25/25; 6c positive control fires.
- **SHAPES 1 of 5 is the fix working** (`anim1c4-shapes.txt`, bench canvas 650 px). Verts before (main) to after, anim then static: crossing 2416 to 2080, 1504 to 2432; circle 1920 to 2048, 4032 to 4096; square 480 to 568, 632 to 632 (signature differs); openArc 3728 to 3872, 3984 to 4224; tick 640 and 576, identical, the one fixture inside the canvas.
- **export-window 38/39 predates this lane.** main bf2c42a58 fails the same KNOWN-BAD row: unwired 45 frames, wired 31, 14 apart against a 15-frame hold, because the wired film keeps its 1 closing frame (`anim1c4-export-window-main-bf2c42a58.log`). A gate matter, not touched.
- **Main's exposure: yes, measured.** `_probe-solid-exposure.mjs` on main bf2c42a58: after the window narrows to 1000 px, Solid drops B (1648 verts, span 0.58, 0.27 of Extrude's). The same probe on this head builds it (3472 verts, 1.003). Both JSONs are in `docs/verification/stroke-timing/`.
- **Full gate, `--grade-solid`, four engines:** 37 PASS, 1 FAIL (solid 4). tsc 6 errors, the baseline.
- Commits on `lane/anim1c` (rebased onto main bf2c42a58, conflicts kept both sides): 94734ef3f, this note. Dev server :3139 killed by exact pid, cwd checked. Sparse base removed, `.next/` deleted.

### F118 lane ANIM-1C5 note, 2026-09-25: NOT MERGE-READY. Solid 4's second cause found in Node, not fixed. The lane hit its 90k context line before the fix.
- **What blocks it.** No fix landed, so solid 4 is still red (not re-run). The four-engine gate, the six baselines and the strip notice are NOT RUN. No dev server or browser was started.
- **Rebase.** `lane/anim1c` sits on main 4d71958e5. 62358b9ff dropped as already upstream (31d0c5b22). The `gaps.mjs` add/add conflict took main's file, which is the lane's file plus the 4d71958e5 fallback; that fallback is the only diff between them. `lib/solid-mask.ts` is main's. The 6a base is still named `base-62358b9ff.json`, a sha no longer on the branch (same patch as 31d0c5b22). Check the gate still finds it before grading.
- **Cause two is the pace table, not the slot start and not the ease inverse** (`solid-bench/slot-start.mjs`). `paceFromCurve` samples rdf at 1024 points, 12.81 ms apart on this word (baseMs 13116), and `clockToBeat` interpolates between them. Stroke 4 lifts at 5832 and stroke 5 lands at 5904. The two samples around the landing sit at 5892.0 (still on the lift) and 5904.8 (inked), so the table ramps from 5892.0 while rdf stays flat to 5904.1. Across those 12 ms the table gives stroke 5 0.0001 to 0.0004 of its arc and shipped gives 0.0000; from 5905 on they agree to 4 places. `sampleTake` reads the table the same way under a neutral row and under ease "in". The ease only decides how much of the take lands in the ramp: take u 0.08 to 0.19 under "in", against 12 ms of take under neutral, which the gate's samples miss.
- **Positive control.** First ink 5904.1 in Node against the browser's 5904.2. B0 5892.0 in Node against the browser's 5890.4: 1.6 ms apart and not explained. The browser's baseMs may not be 13116; read it off `__fsTake.get()` before trusting B0 to the tenth.
- **B0 sits on the last lift sample, read from the code, not measured.** `beatToClock(tr.start)` returned 5892.0, the lift's last sample, where the `paceFromCurve` comment promises the lift's first clock. That only happens if `tr.start` sits a float step above rdf's held beat, so an exact match would put B0 near the lift's start instead. Worth one Node line before the fix.
- **The fix, two candidates.** (a) `clockToBeat` calls the curve itself instead of the table. That makes `sampleTake`'s reach exact and moves no key, since Rod and Inflate read keys through `beatToClock`. Samples and keys then differ by up to one sample at each landing, so check the Node gate's sampleTake-against-keys rows. (b) Put the exact lift start and landing clocks into the table, found by bisection on rdf inside the two samples around each flat. Keys and samples stay one curve and both go exact at a lift, but B0 moves from 5892.0 to about 5904, which shifts every timed row's slot by up to a sample. (a) is the smaller change and is the `sampleTake`-side fix the brief expected.
- Commits on `lane/anim1c`: the rebased chain (d956d77ac to 147789c3e) and this note with `slot-start.mjs`. Nothing started, so nothing to kill; no `.next/` built.

### F118 lane ANIM-1C6 note, 2026-09-25: NOT MERGE-READY. Solid 4 is fixed and the four-engine gate is 38 of 38, but the strip notice (step 5) and the six baselines (step 6) were not done: the lane hit its 150k context gate.
- **What blocks it.** (1) The strip still says "Stroke timing does not reach Extrude/Solid yet", which is now a lie: all four engines grade green. The patch is drafted and NOT applied: `docs/verification/stroke-timing/anim1c6/next/patch-notice.py` (drops `TAKE_REACHES`, `MODE_NAME`, `takeNotice` and the three `data-take-notice` spans in `stroke-strip.tsx` and `draw-in-timing-controls.tsx`) and `patch-gate.py` (row 6 of `assert-stroke-strip` becomes "with rows on Extrude and Solid the strip is up with one bar per stroke and no `[data-take-notice]` exists in the page", armed by a planted notice that must be read back; still 2 rows, so still 18). Run both with python3 from anywhere, then tsc. (2) take-timeline, drawin-timing, export-window, stroke-schedule, stroke-strip and `gaps.mjs` NOT RUN on this head. Their evidence folders are already in the sparse set.
- **The fix, (b), one curve** (85f3a4d0b). `paceFromCurve` still samples 1024 points, then puts each flat's two ends into the table at their exact clocks, bisected on the curve itself to adjacent doubles: the lift start (first clock on the held beat) and the landing (last clock on it). `clockToBeat` and `beatToClock` both read that one table by binary search. Keys and samples are one curve, and exact at every lift. Limit, written in the code: a flat is found by two equal samples, so one shorter than two sample steps (25.6 ms on the gate word, 117 ms on a 60 s drawing) is not refined and ramps as before. Build cost 8.8 ms to about 19 ms, once per take change.
- **Proof, `solid-bench/slot-start.mjs`, now graded, exit 1 on a fail.** AGREE: over stroke 5's first 15 ms from first ink, at 151 instants 0.1 ms apart, table and shipped differ by at most 2.74e-5 of the stroke (bar 5e-5, so 4 places). NO-SLIVER: stroke 5 gets exactly 0 at 720 of 720 instants from stroke 4's pen-up (5832) to first ink (5904.0000 bisected; ANIM-1C5's 5904.1 was its 0.1 ms walk), under the table, `sampleTake` neutral and `sampleTake` ease "in". EVERY: 11 of 11 lifts give the next stroke exactly 0 before its first ink. MUST-FAIL: the old uniform table, copied verbatim into the file, gives stroke 5 up to 0.0004 before first ink and ramps on 11 of 11 lifts. Run against HEAD~1's `lib/stroke-timing.ts`, the file fails AGREE (3.57e-4), NO-SLIVER (600 of 720) and EVERY (0 of 11). Not graded, and written in the file: past the first sample after a landing the table is linear interpolation, off by up to 3.8e-4 of a stroke in a landing's first 15 ms and 1.1e-3 mid-stroke. That is the table's resolution, not the lift. Output: `anim1c6/slot-start.txt`.
- **B0 moved as predicted.** Stroke 5's start beat sits a float step above rdf's held beat (0.4466234280863804 against ...802), so it inverts to the landing: Node B0 5892.0 to 5904.0, the render's B0 5892.1 to 5904.2 (Rod R0). Rod 3's first ink now reads 13116.0 want 13116.0, was 13128.2 want 13128.1. Seen, not changed: stroke 11's start beat EQUALS its held beat bit for bit, so its B0 inverts to the lift's first clock, 12252.0, 72 ms before its first ink at 12324.0 (was 12257.8, the first flat sample). Strokes 1 to 10 start at their landings, stroke 11 at its lift. A float accident in the schedule's beats, worth a ruling before anyone times stroke 11.
- **Node gate, 16 of 16, 12 of 12 mutants.** Its full output is byte-identical on the old table and the new one, because no row calls `paceFromCurve`: its PACE and CLOCK rows hand `buildTimedSchedule` an analytic pace (b squared, square root). So no row moved, and the gate cannot see the table. `slot-start.mjs` is the only Node check that exercises `paceFromCurve`. Output: `anim1c6/assert-stroke-timing.txt`.
- **The 6a base is found.** The gate reads `base-${sha}.json` from `docs/verification/stroke-timing/` by name and never asks git, so a sha off the branch does not matter; a missing file fails the row with NOT RUN. `base-62358b9ff.json` holds 25 Solid hashes, and solid 6a read 25/25 on this run.
- **Full gate, `--grade-solid`, four engines, this head: 38 PASS, 0 FAIL, 0 page errors** (`anim1c6/grade-solid-full.log`). solid 4: worst 0.0037 (knockout 0.4023), was 0.0674 in ANIM-1C4; want 0.068,0.105,0.218,0.458 got 0.072,0.105,0.220,0.458. The wants moved because they come from the render and B0 moved. solid 1 0.0027, 2 0.0053, 3 0.0053, 6a 25/25, 6b 25/25, 6c fires, 7 122/122 twice. Rod 6a and Inflate 6a 25/25 against 1051bc8e1. The two inflate-nose frames the run rewrote were restored with `git checkout`.
- tsc 6 errors, the baseline, none in a touched file. Dev server :3139 (next 62552, listener 62584), cwd checked as this clone, killed by exact pid 62584; 62552 exited with it. `.next/` deleted. One headless browser, through `lib/browser.mjs`.
- Commits on `lane/anim1c`: 85f3a4d0b (the fix and `slot-start.mjs`), 6da235456 (evidence and the drafted patches), and this note.

### F118 lane ANIM-1A7 note, 2026-09-25: MERGE-READY for Rod and Inflate. 20 of 20 browser rows on this head, knockouts firing, no rows byte-identical to 1051bc8e1 on both engines, baselines unchanged.
- **MERGE-READY, Rod and Inflate.** Extrude and Solid stay NOT WIRED under a timed take (they rebuild through `filterStrokesBySchedule`), printed and never counted. The commits, `git log --oneline b23944506..lane/anim1`, 19, newest first: the LOG commit, 8b4395b66 (this note), b11b1a891 4b2c62dc6 e19902e01 b8bbd6a1f 429c2f7a5 941a6b6e6 f18d61bd4 865c44620 262ccb196 6f5111f26 c29fcfc5d cf4942a44 cb10c4206 f20c3c719 ab784e0da 1d7186a37 50442e6b9. Product files touched across them: `components/viewport-3d.tsx`, `components/viewport-3d-wrapper.tsx`, `lib/stroke-timing.ts`, `lib/pen-reveal.ts`, `lib/doc-store.ts`, `app/page.tsx`. ANIM-1A7 changed no product file.
- **Known residual.** The timed path alone misses the shipped path by up to 0.006 of a stroke (ANIM-1A6: 17 of 43 profile points on Inflate's stroke 5). Neutral rows never show it, because an identity take routes to the shipped path (`TimedSchedule.identity`). Any non-neutral row draws through the timed path and carries it. The gate's bar is 0.02.
- **Rebase onto main b23944506** (Rod leak fix, hardened instruments, `_ts-load.mjs` refusing a missing GATE_MUTATE_FILE): no conflicts. Every added line of main's leak-fix block in `components/viewport-3d.tsx` is present in the rebased file (checked line by line). tsc 6, `assert-stroke-timing.mjs` 16 of 16 with 12 of 12 mutants.
- **Row 1, speed.** Now sampled at T = B0r + (s + u·d - B0r)/2, B0r read off the render. Rod 0.0000 (knockout 0.3900), Inflate 0.0008 (knockout 0.3298), was 0.0831 from first ink. B0r reads 5892.1 ms on Rod and 5892.4 on Inflate. Caveat: B0r comes from the speed-2 half-reach crossing, so the sample whose no-rows instant sits at that crossing (u about 0.55 on Inflate) agrees partly by construction. The other three points, the knockout and Rod's exact drawRange do not depend on it.
- **Rows 2 and 3: the instrument, not the product.** `--overlap` with FS_MASK_DUMP dumped four frames at u 0.9 under a 400 ms delay. 88 of stroke 5's 1396 mask pixels were ink under the delay and not under no rows. All 88 sit at the D's stem top, not where the o meets the D. With stroke 5 held back and every neighbour in the same state, a neighbour inked 0 of them; with stroke 5 alone and whole, 78 were not ink. They are stroke 5's own surface, submitted on stroke 6's front, and the shipped path does it too: the no-rows frame at s + 0.9d lacks them, the finished frame has them. Either stroke can own them, so the Inflate mask now also requires ink in a k-alone frame (stroke k whole, every other stroke held back 20 s). Stroke 5's mask went from 1396 to 1316 px, its box from 267..434 to 339..377 in x. Rows 2 and 3 went from 0.0595 to 0.0061 and 0.0175. Row 3 sits 0.0025 inside the 0.02 bar. Frames: `docs/verification/stroke-timing/anim1a7-overlap/` (map-before.png, map-after.png, Fn, Fd, Fh, Fa, quad).
- **Seen, not fixed, not this lane's:** under no rows, the D's stem top pops in when stroke 6 starts, about 250 ms after the D finishes drawing. No-rows frames equal 1051bc8e1 at all 25 grid points, so it predates the take. The base was not sampled at that instant.
- **Identity.** A 1051bc8e1 worktree at `/Users/sebs/.fs-lanes/anim1-base` served :3138. Its grid was grabbed twice and both files are byte-equal, with 25 distinct frames per engine. Worktree removed. On this head: Rod 6a 25/25, Inflate 6a 25/25, 6b 25/25 on both, 6c positive control PASS on both.
- **Full run, this head, `--engines=rod,inflate`:** 20 PASS, 0 FAIL, 0 page errors. Rod: R0, 1, 2, 3, 4, 6a, 6b, 6c, 7 PASS, 5 NOT APPLICABLE. Inflate: R0, 1 to 5, 6a, 6b, 6c, 7 PASS. Log: `docs/verification/stroke-timing/anim1a7-full.log`.
- **Baselines, this head:** take-timeline 20/20, drawin-timing 25/25 (CONTROL rows passed on this run), export-window 39/39, stroke-schedule 57/60. The 3 reds are the same rows with the same numbers as `docs/verification/travel/gates-before/assert-stroke-schedule.txt` (window set subtraction IoU 0.8679, leading edge IoU 0.9367, reverse remap-after). Rewritten artefacts restored with `git checkout`. Logs: `docs/verification/stroke-timing/anim1a7-baselines/`.
- Dev servers on :3138 (lane: npm 36931, 68402; base: 63712), each killed by exact pid after its cwd was confirmed. Disk had 8.3 GB free during the run.

### F120 · The last stroke's timed slot opens 72 ms before its first ink (found 2026-09-25, lane ANIM-1C6)

In `paceFromCurve`, strokes 1 to 10 of the hero start one float step above their held beat, and stroke 11's
start beat equals its held beat exactly, so its slot opens at 12252.0 ms against first ink at 12324.0.
It predates the exact-lift fix. Effect: a delay or hold-back on the last stroke carries 72 ms of pen lift
into its slot. Open. Needs: pick the slot start the same way for every stroke (first ink, or lift start),
prove it on every stroke of the hero with `scripts/verify/solid-bench/slot-start.mjs`, keep
`assert-stroke-timing-browser --grade-solid` at 38 of 38.

### F120 lane F120 note, 2026-09-26: MERGE-READY. Every stroke's slot opens on its first ink, 12 of 12 hero strokes within 1 ms, Node gates green; two browser checks remain for the controller after merging.

**Built** on `lane/f120`, df3e1b009: `lib/stroke-timing.ts` (`paceFromCurve`, and the one slot-start line in `buildTimedSchedule` that reads it), `scripts/verify/solid-bench/slot-start.mjs`, and the two hand-made paces in `scripts/verify/assert-stroke-timing.mjs`. tsc 6 errors before and after, the same six; `--listFilesOnly` shows tsc compiles `stroke-timing.ts`, `stroke-strip.tsx` and `viewport-3d.tsx`. No browser was opened.

**The fix.** One beat is both a lift's start and its landing, so one inverse cannot hand out both. `TimingPace` gains `beatToLanding`, the last clock the curve is still on a beat. At a held beat that is the landing entry the exact-lift table already holds; where the curve rises it gives the same bits as `beatToClock`. A slot starts at `beatToLanding(start)` and still ends at `beatToClock(end)`. Stroke 11 now opens at 12324.0 ms, its first ink, not 12252.0. Byte compare against ea31c5b38 on the hero under 12 neutral rows: 1 of 24 slot values moved, that one; `beatToClock` and `clockToBeat` agree on 8002 of 8002 probes; `takeMs` is 13116 in both. A pace without `beatToLanding` throws in `buildTimedSchedule` instead of falling back to the lift start, so the gate's two hand-made paces got one.

**Correction to the row.** Strokes 1 to 10 do not sit one float step above their held beat. They sit 1 to 5 (6, 7 and 8 at 1, stroke 1 at 5), and stroke 11 sits on it. The new rule does not care which.

**Gate.** `node scripts/verify/solid-bench/slot-start.mjs` adds SLOT-START: each stroke's t0 under a neutral row on all 12 strokes, read off `buildTimedSchedule`, must be within 1 ms of its first ink, bisected on rdf. Three sets of start beats go through it: the hero's own, each set to rdf's held beat, and each one float step above that. 12 of 12 on all three, worst 0.0000 ms, 12 of 12 first inks found. MUST-FAIL-START: the old rule, `beatToClock(start)`, opens stroke 11 at -72.0 ms. `--timing-from=ea31c5b38` swaps in the pre-fix file through GATE_MUTATE_FILE, no disk edit, and SLOT-START fails: hero starts 11 of 12, stroke 11 off by 72.0 ms; starts on the held beat 1 of 12, strokes 1 to 11 off. A rev git cannot show exits 1. AGREE, NO-SLIVER, EVERY and MUST-FAIL still pass.

**Held.** `node scripts/verify/assert-stroke-timing.mjs` 16 of 16 rows, 12 of 12 mutants. `node scripts/verify/solid-bench/gaps.mjs` exits 0, solid misses 0, extrude control misses 0.

**The controller runs these after merging**, in the browser, not run here:
- `node scripts/verify/assert-stroke-timing-browser.mjs --grade-solid`, must stay 38 of 38
- `node scripts/verify/assert-perform.mjs`, must stay 12 of 12

**Not done, outside this lane's files.** Two more places start a stroke with `beatToClock(start)` and keep stroke 11's 72 ms. Read from the code, not run:
- `components/stroke-strip.tsx` lines 208 and 231 build the strip's base slots that way, so stroke 11's bar starts 72 ms before the schedule's slot now does.
- `performedPenMs` in `lib/stroke-timing.ts` hands Rod `beatToClock(start + (end - start) * r)`; at r = 0 on stroke 11 that is 12252.0 while the slot opens at 12324.0. Its comment "u = 0 is B0" is no longer true there.
Each wants its own row.

### F118 lane ANIM-3A note, 2026-09-25: MERGE-READY. The phase 3 key model is built and gated in Node, 16 of 16 rows and 18 of 18 must-fails; nothing reads it yet.

**Built** on `lane/keys`: `lib/keyframes.ts` (0e51dda5e) and `scripts/verify/assert-keyframes.mjs` (02e21c6d9). No `components/`, `stroke-timing.ts` or `stroke-schedule.ts` edit. tsc 6 errors before and after, the same six, and `--listFilesOnly` confirms tsc compiles the new file. No browser was opened.

**The model.** One track per property: `drawProgress` (0..1), `depth`, `turn` (degrees; `FlatState.yaw` is radians, so 3b converts at the write), camera `azimuth` and `elevation` (degrees, `orbitView`'s first two arguments) and `distance` (`orbitView`'s `fillK`). A key is `{ tMs, value, easeOut, easeIn }`. The span between two keys is one cubic bezier, `x1, y1` from the first key's `easeOut` and `x2, y2` from the next key's `easeIn`, solved by `cubicBezierEase` from `lib/hero-motion.ts`, the same copy the stroke timing uses. `makeKey` gives AE's Easy Ease: influence 1/3, which comes out as exactly 3u^2 - 2u^3. `"hold"` goes on `easeOut` only; `"linear"` puts the handle on the diagonal. No keys samples as `undefined`, the shipped value. Before the first key holds the first, after the last holds the last. Width stays out for 3b.

**The drawProgress rule: the key remaps the take's clock, it does not multiply the reveal.** With the key at `p`, the reveal reads the take at `p * takeMs` (`revealClockMs`), which is After Effects' Time Remapping. Two keys at 0.4 freeze the frame the take shows at 40%, per-stroke delays and eases included, then the next key finishes it. Multiplying fails that case: the reveal under the key keeps growing through the hold, and it cuts every stroke to 40% at once instead of showing the drawing at 40%. Camera, depth and turn keep reading `clockMs`, so the camera moves while the drawing holds. DRAW-HOLD proves it on the real `buildTimedSchedule` and `sampleTake`, three strokes with one delayed (a non-identity take): 0 of 41 clocks in the hold differ from the take at 40%, 1.063 of 3 strokes drawn there, whole at 2600 ms. `keysEndMs` returns 2600 for that take, past its 2000 ms, so the playhead and export must run `max(takeMs, keysEndMs(keys))` or the finish never plays.

**AE's curve, derived, not read off our solver.** Bodymovin's `keyframeHelper.jsx` (fetched) writes an AE ease as `o.x = influence / 100`, `o.y = speed * influence / 100 * duration / delta`, `i.x = 1 - influence / 100`; the Lottie spec (fetched) reads `o`, `i` as the inner points of a cubic from [0,0] to [1,1]. Easy Ease is speed 0 at influence 33.33%, so `(1/3, 0, 2/3, 1)`, and x controls at 0, 1/3, 2/3, 1 make x(s) = s. The gate holds the model to 0.028, 0.15625, 0.5, 0.84375, 0.972 at u = 0.1, 0.25, 0.5, 0.75, 0.9; worst error 1.1e-16. AE's displayed 33.33 rather than 1/3 moves the curve by at most 1.07e-5, measured. Adobe's own helpx page was not fetched.

**Rejected, never dropped.** `validateTrack` and `validateKeys` return every reason: unsorted or same-time keys, a non-finite `tMs` or value, a handle x outside 0..1, `"hold"` on an `easeIn`, a drawProgress value outside 0..1, and a property that is not keyable (`width` today). `sampleTrack` and `sampleKeys` throw with the reason instead of sampling. VALID-CONTROL proves the validator accepts a good field, handle x at 0 and 1 included.

**Gate:** `node scripts/verify/assert-keyframes.mjs`, 16 rows, each block guarded so one throw cannot hide the rows after it, and 18 mutants through `GATE_MUTATE_FILE`; the gate exits 1 if any row has no mutant naming it. The "multiplies" mutant stands in as `p * clockMs`, which is what multiplying does on a linear take.

**How phase 3b reads this model.**
- *Stored* as a new document field `keys: TakeKeys` beside `take` in `lib/doc-store.ts`, read by a `readKeys(raw, repairs)` that calls `validateKeys(raw)`: no field reads as no keys; a track with any reason is dropped with each reason pushed to `repairs`, the channel `readTake` already uses. The doc store is not this lane's file.
- *Per frame* in `useFrame`: `const s = sampleKeys(keys, clockMs)`; each defined value is written to its ref (`s.depth` to the flatten ref's `depth`, `s.turn` to its yaw in radians, `s.azimuth`, `s.elevation`, `s.distance` to `orbitView`), and an `undefined` leaves the shipped value alone. The reveal reads `revealClockMs(keys, clockMs, takeMs)`: timed takes pass it to `sampleTake`, the untimed chain divides it by the pen length to get its clock.
- *Length:* the playhead, the strip's seconds axis and export run `max(takeMs, keysEndMs(keys))`.
- *The lane strip:* keys draw as diamonds on their property's own row from the track. Adding one calls `makeKey(tMs, value)`, so every new key is Easy Ease. The curve opened in the lane plots speed by differencing `sampleTrack(track, t)` at pixel spacing; no speed function is needed. Dragging a handle writes that key's `easeOut` or the next key's `easeIn`; the numbers under the curve are `easeOut.x, easeOut.y, next.easeIn.x, next.easeIn.y`, Figma's order. Every edit runs `validateTrack` before commit, and a reason is shown, not swallowed.

**Not done:** anything in the viewport, the doc field, the strip. **Next:** phase 3b, the lane strip and curve editor on this model, plus the per-channel browser gates DESIGN.md §5 names.

### F121 · Perform: the dwell is only checked on Rod, and the stage is flat (2026-09-25, lane ANIM-2C)

`assert-perform` row 1b films a performed dwell on Rod only. ANIM-2C found the stage had dropped the
`performed` field for every engine (the Scene `timed` memo copied four fields), so Inflate, Extrude and
Solid played performed rows linear until 6375c32cf. That is read from the code, not filmed. Open. Needs:
row 1b on Inflate, Extrude and Solid, each with the linear must-fail. Separately, he performs on a flat 2D
copy of the word, not on the 3D view; whether that is right is a look for him to judge on localhost.

**F121 note, 2026-09-26, lane/smallfix.** NOT STARTED. Blocked by the lane's context line: F124 used it.
Nothing in `assert-perform.mjs` changed. Next: row 1b on Inflate, Extrude and Solid with the linear
must-fail each, Inflate measured with per-stroke pixel masks as `assert-stroke-timing-browser` does.

**F121 note, 2026-09-26, lane/f121.** NOT MERGE-READY. Blocked by three things: row 1b fails on Inflate
(below), Extrude and Solid are NOT RUN, and `assert-stroke-timing-browser --grade-solid` is NOT RUN. The
lane stopped at its 100k context line. No product file changed.

What landed, in `scripts/verify/assert-perform.mjs`: row 1b on Inflate, Extrude and Solid. It reads stroke
D's pixel mask, built the way `assert-stroke-timing-browser` builds it, and "held" means the exact inked
count. Each engine gets a positive control (the mask reads nothing before D's slot and the whole D after
it), a read-twice stability control, an exact take restore, and the linear must-fail. `--dwell-engines=`
runs a subset; an engine left out prints NOT RUN and exits 1. `setRows` now throws when a take is refused.
The first run built an empty mask because `takeMs` is null with no take set, so the seek was `t / null`,
which is NaN. The seek now falls back to `totalDuration` and throws when there is no clock.

Run with `--dwell-engines=inflate`: 12 PASS, 1 FAIL, 2 NOT RUN (`perform/f121-assert-perform-inflate.log`).
Rod 1b holds 1031.2 ms against a 1038.2 ms dwell. **Inflate 1b fails**: D's mask is 600 px on the docked
755x493 canvas. It reads 1 px before the slot and 600 after, which proves the mask can see the D. But it
holds exactly 299 px (0.498 of the D) for only 376.0 ms of the 1038.2 ms dwell. The linear must-fail fires
(229 to 372 px).

**Inflate does not drop the pace.** A probe with a synthetic row, flat for the middle third of a 2980 ms
slot, profiled the mask every 40 ms (`perform/f121-inflate-profile-synthetic.json`). Over the 994 ms dwell
the D moves 8 px of 600, where linear moves about 200. The motion sits at the dwell's two ends. The ink
settles from 295 to 299 px over the first 120 ms, flickers between 299 and 300 through the middle, and
creeps from 301 to 303 px over the 110 ms before the pen moves again. Exact stillness fails; the pace holds.

Cause, read from code and not proved: Inflate reveals from an arrival-time field baked in take time. The
nose's back and taper are time lengths, multiplied by the per-texel slope `|dS/da|` (`viewport-3d.tsx`, the
bake near 5247 and the tip uniforms near 6889). Take time keeps running through a dwell, so the nose keeps
filling after the pen stops. The texel at the dwell's jump carries a huge slope, so its taper inks ahead of
the restart. Rod does not see this because it is handed a pen time that stands still (`performedPenMs`).
`assert-stroke-timing-browser` records the same nose inking 69 ms before a slot opens on the shipped path.

No fix made. The brief allows a product fix only when a row proves an engine drops the pace, and 8 px
against 200 is not that. Two ways forward, not decided: freeze Inflate's shader clock per stroke through a
flat run, the way Rod gets a frozen pen time, or have the row read the frontier and not the nose.

Next: `--dwell-engines=extrude` and `=solid`, then the Inflate call above, then the full gate and
`assert-stroke-timing-browser --grade-solid` (38/38). tsc stays at the 6 baseline errors, and only `.mjs`
changed.

**F121 note, 2026-09-26, lane/f121 (F121-B).** NOT MERGE-READY. Blocked by three things: Inflate's hold
is designed and not written, Solid fails row 1b and its cause is outside this lane, and
`assert-stroke-timing-browser --grade-solid` and the full gate are NOT RUN. The lane stopped at its context
line. No product file changed.

Step 1, run on :3139 at 933139daa (`perform/f121-assert-perform-extrude.log`, `-solid.log`, both JSONs):
- **Extrude passes.** D's mask is 461 px. It holds exactly 257 px (0.557) for 1028.1 ms of a 1033.6 ms
  dwell. Positive control 0 px before the slot, 461 after; read twice 257/257; linear inks 207 to 328.
- **Solid fails.** D's mask is 873 px. It holds 532 px (0.609) from 6888.2 ms, the dwell's start, but the
  count changes at 7682.6 ms, 234 ms before the pen restarts: 794.3 of 1036.3 ms. Positive control 0 and
  873; read twice 532/532; linear inks 443 to 631, so the must-fail fires. The tip shader is inert on
  Solid (`revealFracNow` is set only for an Inflate mesh with reveal keys), so this is not the Inflate
  cause. Solid cuts through `takeSpansIn` and `filterStrokesBySpans`, whose reach is `performedAt`, flat
  across the dwell. Not traced. Needs its own lane, since Solid's path is outside this one.

Step 2, Inflate, designed and not written. The per-stroke part is the hard part: the tip field has no
stroke channel and `uFsTipD` is one uniform for the whole word. Three sources move D in a dwell, and a
bake-only fix reaches two of them: the nose's `slope * taper * rho` pushes texels just behind the pen past
the dwell's start; the segment that straddles the dwell's arc interpolates arrival from start to end of
the dwell; and the field's LINEAR filter smears the arrival jump at the nib front across a texel. The
third needs the shader. The design:
1. `lib/stroke-timing.ts`, a performed helper `performedHolds(ts)`: per performed stroke, each run of equal
   samples in `pf` as `{ stroke, t0, t1, arc }`, where `[t0, t1]` is `slot0 + slotLen * [k/m, j/m]`, the
   same interval over which `performedPenMs` stands still, and `arc` is `timedFront`'s
   `reverse ? to - r * span : from + r * span`.
2. The bake near 5247: under `timedBake`, turn each hold's arc into the pen point in the field's local
   plane (walk the word's cumulative length, as `buildTipField` does, then `toX` and `toY`). Keep the 8
   longest holds; publish the rest as dropped on `__heroPenTip` so a cap never passes silently.
3. The shader: `uniform vec4 uFsTipHold[8]` (pen point xy, t0 and t1 as take fractions), `uFsTipHoldN` and
   `uFsTipHoldR`. After `fsWhen`, a fragment within `uFsTipHoldR` of a hold's pen point while `uFsTipD`
   is in `[t0, t1)` compares against `t0`, the dwell's value, and not `uFsTipD`. No derivative sits in
   the loop, and with N at 0 the comparison is the shipped one exactly. Radius
   `(2 + taper) * R + longest segment + 2 texels`, set at the uniforms near 6889 from the live shape.
   This goes one block past the two named line ranges, into `applyPenTip`'s fragment string, which a
   controller should rule on first.
What it costs: the nose ink pending at the stop lands in the frame the pen restarts, instead of creeping
through the dwell. Another stroke drawing inside that disc during the dwell would also wait. NOT COVERED:
the trailing edge of a travel window.

Next, in order: rule on the shader block, write 1 to 3, run `--dwell-engines=inflate` (row 1b must hold D's
exact count within a frame at each end, linear must still fire), `assert-stroke-timing-browser
--grade-solid` (38/38), then the full gate. Solid 1b goes to its own row or lane.

**F121 note, 2026-09-26, lane/f121 (F121-C).** NOT MERGE-READY for Inflate, blocked by one thing: the full
`assert-perform` with all three engines is NOT RUN (the lane hit its context line). Every row it did run
passes on Inflate. Solid 1b stays its own open item, below.

What changed, at 380efad7a, e164aafcd, 5dd4ccd39, 4a3a60583, as the F121-B design wrote it:
- `performedHolds(ts)` in `lib/stroke-timing.ts`: each run of equal samples in a performed pace as
  `{ stroke, t0, t1, arc }`. Checked in node against `performedPenMs` on a two-stroke take with one reversed
  track: the pen time is one value across every hold and moves on both sides of it.
- Inflate's tip bake walks each hold's arc to the pen point in the field's local plane, keeps the 8 longest,
  and publishes `holds`, `holdsDropped` (with the reason) and `holdMax` on `__heroPenTip`.
- `applyPenTip`'s fragment test reads `uFsTipHold[8]`, `uFsTipHoldN` and `uFsTipHoldR`. The loop has a
  constant bound and no derivative or discard in it; at N 0 the tested line is the shipped one. Cache key v7.
  The radius is `(2 + taper) * R + longest segment + 2 texels`, set per frame from the live shape.
- The gate's row 1b now also holds each end within one frame of the row's flat run, and on Inflate needs
  the published hold on stroke D to match that flat run within 1 ms, with no dropped hold longer than the
  shortest kept one.

Run on :3139 (`perform/f121c-assert-perform-inflate.log`, `f121-dwell-engines-inflate.json`, the strip PNG):
- **Inflate 1b passes.** Stroke D's mask is 600 px. It holds exactly 292 px (0.487) for 1031.1 ms of a
  1036.0 ms dwell, 6885.8 to 7917.0 ms, ends 2.3 ms early and 0.2 ms early against the flat run. Before this
  change it held 376 of 1038 ms. Positive control 1 px before the slot, 600 after; read twice 292/292; the
  linear must-fail fires, 229 to 372. The rest of the gate on this run: 13 PASS, 0 FAIL, Extrude and Solid 1b
  NOT RUN by the flag; row 8 still matches main's 18 frames with no performance.
- `assert-stroke-timing-browser --grade-solid`: 38 PASS, 0 FAIL on Rod, Inflate, Extrude and Solid
  (`perform/f121c-assert-stroke-timing-browser-grade-solid.log`), so takes with no performed pace draw as before.
- tsc: 6 errors, the baseline, none added.

Found on the way, both open:
- **The cap drops 52 holds on this gate's input.** The gate's stepped pointer leaves 59 short flat runs on
  stroke D besides the dwell, each 15 to 30 ms. The bake keeps the dwell and 7 runs of 30 ms, and publishes
  the other 52 as dropped. Near each dropped run the ink may creep for up to two frames while the pen stands
  still; the 7 kept ones do not. Which short runs get the hold is arbitrary among equals. A floor on hold
  length, or merging runs, is a design call for the controller. Not measured on a real hand.
- In the strip's third frame (20 ms before the dwell ends) a second mark appears right of the stem's foot.
  By the slots it reads as stroke 6 starting on its own slot inside D's dwell, which is right. Inferred from
  the row's speed, not checked. The design's stated cost stands: another stroke drawing inside the hold's
  disc during the dwell waits for the pen.

Solid 1b, its own open item, unchanged: at 933139daa it holds 532 of 873 px for 794.3 of 1036.3 ms and changes
count 234 ms before the pen restarts. The tip shader does not run on Solid. Cause not traced; it needs its own
lane on Solid's `takeSpansIn` / `filterStrokesBySpans` path.

Next, in order: run the full `FS_PORT=<port> FS_HEADED=0 node scripts/verify/assert-perform.mjs` (Extrude
must still pass under the new end check; Solid 1b is expected to fail as above). If Extrude passes, Inflate is
MERGE-READY. Then rule on the 8-hold cap.

### F122 · After the canvas resizes, the frame stays a sub-pixel off until the next render (2026-09-26, lanes ANIM-3G and ANIM-4D)

Opening the Presets panel shrinks the GL canvas (755x890 to 755x449). The frame drawn about 160 ms later
sits a fraction of a pixel off the frame drawn after the next Viewport3D render: every grid line and stroke
edge moves (19,876 px differ, max 233). It holds for 4.5 s; setProgress, setPlaying and setSpin(0) do not
settle it, while setStyle({}) and setLoop(true) do. ANIM-3G saw the same when the dock first resizes the
canvas (8,820 px, all edges). Something in components/viewport-3d.tsx reads a size that goes stale on a
resize. Open. Needs: the stale value named, the frame after a resize equal to the settled frame, measured
with scripts/verify/_probe-customize-drift.mjs (on lane/presets) or an equivalent, with a must-fail.

**F122 note, 2026-09-26, lane/resize.** NOT MERGE-READY: the cause is named and proven, the fix and
`assert-resize-settles.mjs` are not written. The lane stopped at the 150k context line.

The stale value is the GL viewport, not a size in React. Opening the Preset popover measures the canvas at
755.5 x 627 CSS px. R3F calls `gl.setSize(755.5, 627)`, and three 0.175 floors the buffer
(`canvas.width = floor(755.5)` = 755) but rounds the viewport (`setViewport` uses `round()`, 756). Every
frame then draws a 756 px viewport into a 755 px buffer, so x stretches by 1/755 from the left edge. It holds
until something calls `setRenderTarget(null)`, which re-derives the viewport with `floor()` (755). On `/` the
only caller in this flow is drei's `<Environment>`: its layout effect runs `CubeCamera.update` when its host
re-renders, which `setStyle({})` and `setLoop(true)` cause and `setProgress`, `setPlaying`, `setSpin` do not.
Viewport3D itself does not re-render on either settle step.

Measured with `scripts/verify/_probe-resize-drift.mjs --why` (headless, 1512x982, dpr 1), output in
`docs/verification/resize/probe-main.txt` and `probe-main-window.txt`:
- Panel open, 755x890 to 755x627: viewport 756 at A1, A2 and A3 (600 ms), 755 after `setStyle({})`. A vs
  settled B: 25,763 px differ, max 229. B vs B: 0.
- Window 1512x982 to 1400x900: CSS width 699.5, viewport 700 on a 699 buffer, 755 to 699 after settle. A vs
  B: 29,694 px, max 255. Settling with `setLoop(true)` gives the same result.
- R3F draws 30 frames in 500 ms while the frame is wrong, and one hand render with the live state reproduces
  the wrong frame byte for byte, so nothing is stuck. The state itself is wrong.
- Ruled out at full float precision, A3 vs B: camera left/right/top/bottom/zoom, projection matrix,
  matrixWorld and its inverse, orbit target, all 75 scene object matrices, `state.size`, pixel ratio.
- `canvasWidth x canvasHeight` (the stroke-to-world scale input, `innerWidth / 2` and `innerHeight - 48`)
  reads 756x934 before and after both resizes and after both settle steps, so it is not the cause. It is
  stale against the window after a window resize (756x934 on a 1400x900 window) and would jump the form's
  scale at the next Viewport3D render. Separate question, not touched.
- Positive control: dither on moves 3,759 px in the same differ.

Next step, in this order:
1. Fix in `components/viewport-3d.tsx`: a helper that sets the viewport to the buffer,
   `gl.setViewport(0, 0, canvas.width / pr, canvas.height / pr)`, called from a store subscriber mounted in
   `Scene` (`useStore().subscribe`, registered after R3F's own, so it runs right after R3F's `gl.setSize` in
   the same `set`) and after the still export's restore `gl.setSize` (~line 4724), which leaves the same
   756 viewport on screen after every export. Keep a harness switch to turn it off for the must-fail arm.
2. Before the fix lands, record main's no-resize frames (untouched, dither on, ASCII on) as hashes for the
   byte-identity row.
3. `assert-resize-settles.mjs`: panel arm and window arm, A1 equals B with the fix, differs with the switch
   off; no-resize frames byte-identical to the main hashes, with a hand-written 756 viewport as the must-fail.
4. Regressions: assert-stroke-strip 18/18, assert-take-timeline 21/21, assert-stroke-timing-browser
   --grade-solid 38/38. tsc baseline 6.

Also found, not fixed: the still export at 1x and at odd scales draws with the rounded viewport too (the
export's own `setSize` is never floored), so an export from a half-pixel-wide canvas is stretched by 1 px in x
against the on-screen frame. Needs its own row and `assert-still-export`.

**F122-B note, 2026-09-26, lane/resize.** MERGE-READY. `syncViewportToBuffer(gl)` in
`components/viewport-3d.tsx` sets the viewport to the buffer, `gl.setViewport(0, 0, canvas.width / pr,
canvas.height / pr)`. It runs from a `useStore().subscribe` in `Scene` on a size or dpr change (after R3F's own
subscriber, so right after its `gl.setSize`) and once on mount, and after the still export's `setSize` and its
restore. `window.__fsViewportSync = "off"` parks main's rounding. Nothing he sees changes except the stretch.
`scripts/verify/assert-resize-settles.mjs`, 4 of 4 rows graded, output in
`docs/verification/resize/assert-resize-settles.txt`:
- Row 1, Preset panel open (755x533 to 755x270, css 755.5): first frame vs settled frame 0 px with the fix;
  12,086 px (max 247) with the switch off, viewport 756 on a 755 buffer.
- Row 2, window 1512x982 to 1400x900 (css 699.5): 0 px with the fix; 15,520 px (max 230) off. Settled by
  `setRenderTarget(null)`, because `setStyle({})` there also re-renders Viewport3D and picks up F123's scale
  jump (2,745 px, printed, not graded).
- Row 3, still export through the PNG button at 1x, 2x, 4x: every on-screen render from click to download
  draws viewport = buffer, and the 1x PNG on Transparent equals the screen frame with grid and shadow hidden,
  0 px. Off: 1,770 px differ at 1x, renders at 756x270 on 755x270, and 1511x541 on 1511x540 at 2x.
- Row 4, no resize: untouched, dither and ASCII frames byte-identical to main's hashes on both arms
  (`docs/verification/resize/main-hashes.json`, recorded before the fix, two loads agreed). Must-fail: a
  viewport written by hand 1 px wider changes the hash.
Regressions, outputs in `docs/verification/resize/gates/`: assert-still-export all rows pass, both controls
rejected; assert-stroke-strip 18/18; assert-take-timeline 21/21; assert-key-lanes 11/11;
assert-stroke-timing-browser --grade-solid 38/38. tsc 6, baseline. Not covered: dpr 2 (a x.5 css width is
exact there, x.25 would still show it) and the 3-Up compare canvases. The UI's only odd export scale is 1x.

### F123 · After a window resize, the stroke-to-world scale reads the old window until Viewport3D re-renders (2026-09-26, lane F122-B)

`canvasWidth`/`canvasHeight` in `components/viewport-3d.tsx` (`innerWidth / 2` and `innerHeight - 48`) are
read on a Viewport3D render, not on a resize. After a window resize from 1512x982 to 1400x900 they stay at
756x934, so the form keeps the old scale until something re-renders Viewport3D, and then it jumps: on
lane/resize with the F122 fix, `setStyle({})` moves 2,745 px (max 255, bbox confined to the form) and the
stroke scale reads 700x852 after it. The GL viewport equals the buffer at every step, so this is not F122.
Measured by `scripts/verify/_probe-resize-drift.mjs --window` and printed, not graded, by
`scripts/verify/assert-resize-settles.mjs` row 2. Open. Needs: the scale read from the resize, or the jump
ruled acceptable, with the frame after a window resize equal to the frame after `setStyle({})`.

### F124 · Customize: a field's Reset floats in the gap between the two columns (2026-09-26, controller)

Seen in `docs/verification/presets/customize-dither-after-1280x800-panel.png`: the edited Cell size's
"• Reset" sits at the right edge of the left column, in the gutter, not beside its field's label. It reads
detached. Open. Needs: the Reset beside the field it resets, in both columns, at 1512 and 1280.

**F124 note, 2026-09-26, lane/smallfix.** MERGE-READY for the placement and its gate. Not run on this
tree: `_probe-customize-leaks.mjs` (the lane hit its context line first). Run it before the merge.

Each edited field's dot and Reset now sit 8 px after its label's text, centred on that line, in both
columns. `components/style-panel-scaffold.tsx`: `Field` hands a scoped field to `ScopedField`, which places
the mark absolutely from the label's last text line (a Range over the first span with its own text),
again on every render and when the field resizes. A last line too long for the mark puts it at the
field's right edge on that line; a field with no text span keeps the old corner. The read-only rows keep
their own corner mark. Rejected: portaling the mark into the label span. Inside the `<label>` the Reset
button became the control the `<label>` names, so the slider read as unnamed ("slider", no name) and the
button as "Cell size 14.0 14". Now: slider "Cell size 14.0", button "Reset" (ariaSnapshot, headless).

`scripts/verify/assert-custom-presets.mjs`, 47/47 (43 old rows unchanged plus 4), output in
`docs/verification/presets/f124-assert-after.txt`: per size, every Reset inside its field's box, on a
label line, 0 to 16 px from the label text, over every column (2 of 2 columns at both sizes).
- 1512x982: ditherScale gap 8, ditherContrast gap 8.3. 1280x800: the same.
- Must-fail, the old `absolute right-0 top-0` put back by a test-only style: 513.6 and 504.8 px at 1512,
  397.6 and 388.8 at 1280. The real old code, run before the fix, gave the same four numbers to 0.1 px
  (`f124-assert-before.txt`, where both size rows FAIL), so the arm is the old placement.

Seen in `customize-dither-reset-1512x982.png` and `-1280x800.png` (written by the gate, section scrolled
into view): "Cell size 14.0 • Reset" in the left column and "Contrast 100% • Reset" in the right, the dot
on the label's x-height, Reset at regular weight in the muted grey, nothing in the gutter. The field box
stays 25 px tall. `_probe-customize-look.mjs after dither` passed at both sizes on the rejected portal build
only; its shots were dropped and it was not re-run on the final build. tsc 6, baseline. Not covered:
families other than Dither, dpr 2, a label that wraps.
**F123 note, 2026-09-26, lane/f123.** MERGE-READY. The form no longer jumps after a window resize: the
stroke-to-world frame is read once, from the window Viewport3D mounted in, so a resize changes nothing then
and nothing at the next click. **His call to judge: the frame is the load window, not the live one.**

Where it was: `canvasWidth`/`canvasHeight` were computed in Viewport3D's body from `window.innerWidth / 2`
and `window.innerHeight - 48` on every render, not passed from `app/page.tsx` (no window read there).
Nothing re-renders Viewport3D on a resize: neither it nor the page has a resize listener or window-size
state, and R3F's own resize updates its store, which re-renders only what sits inside `<Canvas>`. Measured
below: after the resize the form's world width holds at 3.5004 until `setStyle({})`.
The old size held until a style change, a stroke or any parent state change re-rendered Viewport3D.

What main does at load, measured with `docs/verification/resize/f123-probe-load.mjs` (logo strokes, dpr 1):

| | frame | form world width | camera zoom | form on screen |
|---|---|---|---|---|
| load 1512x982 | 756x934 | 3.5004 | 75.05 | 187x136 on 755x533 |
| load 1400x900 | 700x852 | 3.8354 | 57.96 | 159x115 on 699x451 |
| 1512x982 resized to 1400x900 | 756x934 | 3.5004 | 75.05 | 187x136 |
| then `setStyle({})`, main | 700x852 | 3.8354 | 75.05 | 205x148, 9.6% bigger |
| then `setStyle({})`, fix | 756x934 | 3.5004 | 75.05 | 187x136 |

The camera frames the form at load, so the world scale never shows at load. Through a resize the camera
keeps its zoom and the 2D drawing keeps its pixels (the drawing canvas never rescales strokes), so the form
keeping its size is the one reading that matches both. Rejected:
- the live window, updated on resize: the form would grow 9.6% on screen as the window shrinks with nothing
  around it moving, and every mesh would rebuild on every resize event of a drag.
- the drawing canvas's own size: 755.5x890 is not the 756x934 main maps with, so every frame would change
  against main, and it follows the window anyway.
- the size the strokes were drawn at: it has to be saved with the strokes in `app/page.tsx` and
  localStorage, outside this lane, and a drawing made across two window sizes has no single size.
Still window-dependent: a reload. Reloading at another size maps with the new window, as main does today, and
the camera frames it on load, so nothing jumps. If a reload should keep the scale too, the frame has to be
saved with the drawing. That is its own row.

The fix, `components/viewport-3d.tsx`: `useState` reads the window once; `window.__fsStrokeFrame = "live"`
parks main's per-render read for the must-fail. `scripts/verify/assert-resize-settles.mjs`, 5 of 5 rows
graded, output in `docs/verification/resize/assert-resize-settles.txt`:
- Row 5 (new), window 1512x982 to 1400x900, settled by `setRenderTarget(null)`, then `setStyle({})`: 0 px
  differ, form world width 3.5004 to 3.5004. Live arm: 2,745 px (max 255), width 3.5004 to 3.8354, and that
  frame is byte-identical to main's own frame after the same steps (`81ee5fbd80f44daa`), so the arm is main.
  Row 5 also passes on the F122 `off` arm. Frames: `f123-fix-after-setstyle.png`, `f123-live-after-setstyle.png`.
- Rows 1 to 3 unchanged, green with the fix and red with `__fsViewportSync` off. Row 4: 3 of 3 no-resize frames
  byte-identical to main's hashes; the probe's loads at 1512x982 and 1400x900 are byte-identical too.
Regressions, outputs in `docs/verification/resize/gates/f123-*.txt`: assert-stroke-strip 18/18;
assert-take-timeline 21/21; assert-key-lanes 11/11; assert-stroke-timing-browser --grade-solid 38/38.
tsc 6, baseline. Not covered: dpr 2, the 3-Up compare canvases, and a Viewport3D remount after a resize, which
re-reads the window; not measured.

### F125 · Solid does not hold a performed pause: it moves 242 ms early (2026-09-26, lanes F121-B/C)

`assert-perform` row 1b on Solid: stroke D holds 532 of 873 mask px from the dwell's start (6887.8 ms) but
changes at 7678 ms, 790 of about 1036 ms, about 242 ms short. Rod, Inflate and Extrude hold within a frame.
The pen-tip shader does not run on Solid; Solid cuts through `takeSpansIn` and `filterStrokesBySpans`, and
its reach `performedAt` is flat across the dwell, so the cause is elsewhere in Solid's rebuild path (the
tick, the clip, or the 50 ms hold minimum does not apply there). Open. Row 1b on Solid stays RED on main
until this lands; it is not hidden.

**2026-09-26 · F125 lane note. NOT MERGE-READY: no fix yet, the lane stopped at its context line.**
What the clip hands Solid is flat. `f125-probe.mjs` (hook in `f125-probe-hook.patch`, not applied on the branch)
seeks the kept take in 20 ms steps and logs each `animatedStrokes` rebuild. From 6888 to 7908 ms, stroke D's span
stays `[0, 0.5]` and its piece stays 56 points with no `clipArc` (grow plus identity drops the tag). Each seek
rebuilds twice, and the rebuild's playhead times `takeMs` equals the seek clock exactly. That rules out all three
named causes: the tick reads the take's clock, `takeSpansIn` honours `performed`, and no short-piece raster runs.
What moves is stroke 6. Its slot opens at 7668 ms, inside D's dwell, because D's performed slot runs to 8886. From
7668 on, Solid builds 4 clusters instead of 3 and D's mask ink goes 532, 533, 534, 533 while D's span is still flat
(`f125-probe.json`). The gate's 7678 is that moment plus half a frame. Extrude sees the same o start and holds.
Not settled: whether D's own Solid geometry changes or the partial o inks 1 or 2 px that the finished o does not
(the mask only excludes pixels the finished neighbours ink). `f125-probe-mesh-solid.json` read identical vertices in
D's box at 7628 to 7808, with the o and with it held back, but that run had no positive control, so it proves nothing
yet. `f125-probe-mesh.mjs` now reads 6800 and 6868 first, where D grows, as that control.
Next: apply the patch, run the mesh probe. If D's vertices hold, the fix is in row 1b's instrument (read D's mask
against a frame with stroke 6 held back, or count only pixels no partial neighbour can reach), not in Solid. If they
move, the owner is `buildSolidClusters` in `lib/geometry-engines.ts`, outside this lane's files.

**2026-09-26 · F125-B lane note. MERGE-READY. It was the instrument, not the product: Solid holds D still for the whole dwell.**
The mesh probe now has its positive control and passes it. With the hook applied, D's box read 650 then 652 vertices at
6800 and 6868 ms with different sums, so the probe sees D grow. From 7628 to 7808 ms it read 486 vertices with identical
x, y and z sums at every clock, with the o and with the o held back, while the whole mesh went from 5968 to 6736
vertices when the o arrived (`f125-probe-mesh-control.json`). D's geometry does not move, so `buildSolidResultForStrokes`,
the function this row calls `buildSolidClusters`, is untouched. What moved was two pixels. From 7688 ms the partial o
inks (388,256) and then (389,255), each 1.0 px past the finished o's edge, which put them inside D's mask. With the o
held back, D reads 532 at every clock from 6950 to 7880 ms. Extrude and Inflate flip no pixel at all.
The fix is in row 1b of `assert-perform.mjs`, on every engine. A pixel within 1 px of a finished neighbour's ink, a 3x3
square, is left out of D's mask: 25 px of 873 on Solid, 16 on Inflate, 7 on Extrude. A new reach audit backs the margin.
It replays the take with D alone held back, checks the neighbours kept their slots, and reads every clock the row read,
25 of them; one counted pixel inked fails the row. Holding every other stroke back was the other option. I did not take
it because it would hide a neighbour that moves D's geometry, which is the defect the mesh probe had to rule out.
Must-fails: with the margin at 0 the audit fires on Solid from 7682.8 ms and names (388,256), (389,255), (386,257) and
(385,258), and the row fails at 793.8 ms held (`f125-assert-perform-solid-reach0.log`). The linear arm still fires on all
three engines: Solid 432 to 606, Inflate 229 to 360, Extrude 207 to 321.
Gates, hook reverted: `assert-perform --dwell-engines=solid` passes 1b on Solid, 13 PASS with the other 2 engines NOT RUN
as that flag means; full `assert-perform` 15 PASS 0 FAIL, Solid held 1028.5 ms against a 1035.2 ms dwell with both ends
0.2 ms from the row's flat run; `assert-stroke-timing-browser --grade-solid` 38/38; tsc 6 errors, the baseline.
Seen, not chased: on Inflate, holding the o back moves D's mask ink from 292 to 282 at every clock, before the o's slot
opens. It is flat both ways, so row 1b does not care, but a held-back stroke changes another stroke's pixels there.
F125's "row 1b on Solid stays RED on main" closes when this lands.

## FLIP-1 · 2026-09-26 · the flip's pose law moved to `lib/flip-pose.ts`, gated exact

MERGE-READY. Branch `lane/flip`, commit 5f8c67929 on 9df4eb486. Node only, no browser, no dev server.

- **Moved, verbatim:** `turnPhase`, `turnPose`, `ddFlipEase`, `cubicBezierEase`, `easeInOutCubic`, `clamp01`, `DEG`, `solidDepthAt`, `solidShade` and their two constants. `lib/hero-motion.ts` imports them back and re-exports its three old exports, so the lab runs the same objects. The only edits are `export` and `turnPose`'s `e` typed as `FlipLook` (the two fields it reads). The moved comments keep their 9 old em dashes, so the move diffs as a move.
- **New:** `flipPoseAt(clockSec, opts)` returns `{ ink, depth, yaw, shade, sx, inDwell }`, or null when off. Seconds, not the plan's ms: the law runs in seconds and a unit change at the boundary would move results by a rounding step. `beatSec` is the whole turn including the dwell. No `shadow`: hm's turn never computes one, it is `FormState`'s `shadowLaw`.
- **Gate `scripts/verify/assert-flip-pose.mjs`: 8 of 8 rows, 10 of 10 mutants caught, exit 0, 3 s.** Exact equality (Object.is) against a frozen transpiled copy of 9df4eb486: 128,962 law values, 80,600 flip values at 2,001 clocks per case plus ends and boundaries, and 40,300 against the live `sampleEmerge`/`sampleReturn`. Dwell is exactly 2 frames at 30 fps in 16 of 16 runs. The half-width pose lands at 87.36 % of the out-turn.
- **Finding:** the plan credits the curve to `ddFlipEase`. The turn actually runs on `easeInOutCubic` under the `|cos|` law; `ddFlipEase` only drives the parked "prior" light ramp. On `ddFlipEase` the breakdown would land at 61.87 %. Both are gated.
- **tsc:** 6 errors, the baseline, none in these files. Seven hero gates (turn, options, return, carve, hold, word-legible, motion-paste) fail, and fail byte-identically on the old `hero-motion.ts`, so the move did not cause them.
- **Next, phase 2, after motioncustom and handdraw merge:** store `flip` in `app/page.tsx` beside `flatten` through `edit()`; fold `flipPoseAt` into `components/viewport-3d.tsx` between the host pose and the keys, on the `keyReader` clock divided by 1000; the pills under Shading in `components/draw-in-timing-controls.tsx` (Off, Flat to solid, Solid to flat; start when the draw-in ends or at the playhead); the strip marker; gate `assert-flip-slash` F1 to F7. Also worth deciding: `sampleEmerge`'s turn branch could call `flipPoseAt` so the composition has one copy too; this phase kept hm to imports only.
### MOTION-CUSTOM note, 2026-09-26: NOT MERGE-READY. Customize now shows under all five draw-in presets and the gate reads 41 of 41, with 40 of 40 must-fail rows red. The screenshots were not opened, and assert-custom-presets and assert-stroke-timing-browser were not run: the lane hit its context line.

Branch `lane/motioncustom` in `~/.fs-lanes/motioncustom`, on main 95f724f87. tsc: 6 errors, the baseline. Dev server on :3139 (pid 9235), cwd checked, killed by pid; `.next/` deleted.

**How a draw-in preset lands (step 1).** `applyMotionPresetById`, `app/page.tsx:1400`, calls one `edit` that writes `drawIn`, `revealWindow` and `revealEnvelope` (spread onto the defaults) plus `styleState.activePresetFamily/activePresetId`. The take lives in page.tsx state (`app/page.tsx:411-413`), not StyleState, so `applyPresetToStyleState` refuses the family.

**What changed:**
- `lib/style-system.ts`: one field model for both halves. `presetFields` reads `applies` and `motion`, keyed flat (`drawIn.overlap`, `revealWindow.mode`, `envelope.ease`). `presetEditedFields` takes the live take; `resetPresetField` skips motion keys and the new `presetTakeReset` returns the take patch; `saveMinePreset` stores the live take as the saved preset's `motion`. Rename and delete were already generic. `resolveMotionPreset(id, state)` now finds his saved ones.
- `app/page.tsx`: `applyMotionPresetById` passes the style state, so a Mine draw-in preset applies. `lib/doc-store.ts`: `validateCustomPresets` keeps `motion` on reload instead of dropping it, same key and type rule as `applies`.
- `components/draw-in-timing-controls.tsx`: takes `wrap` (Customize's `<Field>`) around each block, and `showPace` adds Natural / Authentic, which lived only on the transport. Reverse and Loop got a "Playback" label so their Reset mark has a line to sit on. Both cards got `break-inside-avoid`.
- `components/style-panel-scaffold.tsx`: `customizeControlsFor("geometryAnimation")` returns `[AnimationControl]`. In Customize it renders the same `DrawInTimingControls` behind `<Field group k={MOTION_FIELD_KEYS}>`, so every other family still hides it. Reset and Reset all write the take through its own patch calls.
- `_probe-customize-coverage.mjs`: follows `wrap={fieldWrap}` into the draw-in file, read as text there, and says so on every run.

**Gate, `FS_PORT=3139 FS_HEADED=0 node scripts/verify/assert-motion-customize.mjs`: 41 of 41**, 5 presets of 6 in the family (Completion Pulse has no motion and its pill is disabled). Per preset: Customize lists exactly its 12 keys; one Overlap step changes the page's own schedule and duration; Reset one and Reset all put the take back; Save as mine stores the edit and reapplies it after switching away and back; Rename changes only the label; Delete removes it. Must-fail pass with `window.__FS_GATE_MUTATE="presetFields-applies-only"`: 40 of 40 rows red. Output in `docs/verification/motion-customize/`.

**Static probes on this tree:** `_probe-customize-leaks` 7 controls, 73 Field wrappers, 0 leaks. `_probe-customize-coverage` geometryAnimation 12 of 12, every family covered (exit code not captured: the run was piped).

**Left, in order:** (1) Open `customize-authenticDraw-1512x982.png` and `customize-loopingStroke-1512x982.png` (all five tie at 12 fields; Looping Stroke is the one with Length live) and compare to Fusion's Customize: columns, spacing, labels, Reset marks. (2) `assert-custom-presets` (47 of 47 on main), `assert-stroke-timing-browser --grade-solid` (38 of 38), both probes with exit codes. (3) Look at the mutate switch in `presetFields`: it reads a window flag in dev and prod. (4) Flip to MERGE-READY if all pass.

**His localhost steps, once it lands:** open `/`, Style bar, Preset chip, family Geometry Animation, pick Authentic Draw. Customize shows Draw in, Window, Delay, Pace, Ease and Playback in two columns. Move Overlap: a dot and Reset appear beside it and the take replays with the new overlap. Save as mine, pick Smooth Reveal, pick yours again: your overlap comes back.

### MOTION-CUSTOM-2 note, 2026-09-26: NOT MERGE-READY. Customize's Motion section is three cards and nothing sits loose or cut off; 41 of 41 and 48 of 48 pass. assert-perform was not run: the lane hit its context line

Branch `lane/motioncustom` in `~/.fs-lanes/motioncustom`, on 3fd2543da. Dev server on :3139 (pid 19810), cwd checked, killed by pid; `.next/` deleted.

**What I saw first, at 1512x982 and 1280x800** (`c2-*-before-panel.png` and `-bottom.png`, all eight opened). Both families get the same drawer: two columns (619 px at 1512, 503 px at 1280), the section heading, 16 px between blocks, and the same 40 px fade at the bottom of the drawer's scroll box. Under Fusion, fields sit loose under each system heading; the only cards are the numbered layer cards in Layers. Under Authentic Draw, Draw in and Window were cards, and Delay, Pace, Ease and Playback sat loose under Window, so the Motion section read as two boxes plus four stray rows. Nothing was cut off on the page: scrolled to the bottom, Playback shows whole under both families at both sizes. The "cut off" in the old gate shot was that shot's fault: it photographed the section through the drawer's fade. Order, Ends, Pace and Ease were small pills while Align, Unit, Direction and Playback were full-width black bars. Fusion's Customize mixes nothing like that: its choices are pills (Loop, Arc, Burst), selects and sliders.

**What changed:**
- `components/draw-in-timing-controls.tsx`, layout and styling only, no handler touched. Delay, Pace, Ease, Cadence and Playback now sit in one card, "Whole draw", built like Draw in and Window, with "once" or "loops" on the right. Delay moved below The form so the new card does not wrap The form's own card. Align, Unit, Direction, Reverse and Loop are pills like Order. The form's card now uses the same edge and gap as the others (`border-border/70`, `mb-3`, `break-inside-avoid`); it was the one darker box. This file renders all three doors, so the Animation tab and the Timing popover change too. The Animation tab is right with it: at 1512 it now reads as three columns of whole cards, Stroke and Draw in, Window and The form, Whole draw (`c2-animation-tab-1512x982-after.png`, opened). The Timing popover was not shot.
- `lib/style-system.ts`, `presetFields`: the gate's window flag is read only when `NODE_ENV !== "production"`, the rule `__fsViewBlocker` already follows. Next inlines NODE_ENV in a production build, so no production path can reach it. `flag-production-check.log`: with the flag set, production reads 12 fields and development reads 0.
- `scripts/verify/assert-motion-customize.mjs`: the two section shots unclamp the drawer's scroll box for the shot and put it back, so the picture shows the whole section without the fade.

**Seen after** (`c2-geometryAnimation-authenticDraw-*-after-*.png`, opened at both sizes): three cards, Draw in on the left (330 px), Window then Whole draw on the right, tops aligned at the same y, 16 px between Window and Whole draw. No row outside a card. The right column runs 113 px longer than the left at 1512.

**Reset mark** (`c2-geometryAnimation-authenticDraw-1512x982-edited-panel.png` beside `c2-fusion-wholeCloth-1512x982-edited-panel.png`, both opened): one Overlap step shows the dot and Reset 8 px after "Overlap", with the value still at the right end of that line. Under Fusion, Link's mark sits after "Link 0.65". Same rule, after the label.

**Gates, all on :3139 from this clone, exit codes read without a pipe:**
- `assert-motion-customize`: 41 of 41, exit 0. Must-fail with the flag: 40 of 40 rows red, every Customize row red.
- `assert-custom-presets`: 48 of 48 graded, 0 SELF, exit 0. Main's 2 SELF rows grade here because this tree changes product code. This clone is sparse and has no `docs/verification/presets/`, so the first run failed its 4 byte-identity rows on "no base file"; the rerun read main's two base files, copied in for the run and deleted after.
- `_probe-customize-coverage`: exit 0. `_probe-customize-leaks`: exit 0, 73 Field wrappers, 0 leaks.
- `assert-stroke-timing-browser --grade-solid`: exit 1, 34 of 38. The 4 failures are the 6a rows on all four engines, each "no base file" under `docs/verification/stroke-timing/`, which this sparse clone does not have. Not graded, so not a pass. Next: run it on a clone that has those base files.
- `assert-perform`: NOT RUN. Row 8 should GRADE rather than SELF on this tree; nobody has checked.
- tsc: 6 errors, the baseline.

**Seen, not changed:** draw-in labels are 10 px uppercase and its selected pill is black; Fusion's labels are 12 px sentence case and its selected pill is grey. The two never share one Customize, since only the preset's family shows, so I left both.

**His localhost steps, once it lands:** open `/`, Style bar, Preset chip, family Geometry Animation, pick Authentic Draw. Customize shows three boxes: Draw in, Window, Whole draw. Scroll the drawer to the end: Playback shows whole. Open the Animation tab: the same boxes, no loose rows.

**MOTION-CUSTOM, merged 2026-09-26 by the controller.** The two runs MOTION-CUSTOM-2 left were run from the lane's own server: `assert-stroke-timing-browser --grade-solid` 38 of 38 (its base files are untracked in main and were copied in), and `assert-perform` 15 of 15 with main's script. The lane's copy still had row 8's `base.performButton === false` clause, retired on main at `eb27a5860`, and failed on that clause alone. Every other part of row 8 held. On main after the merge, from :3000: `assert-motion-customize` 41 of 41 (must-fail 40 of 40 red, 5 of 6 presets, Completion Pulse has no motion); `assert-custom-presets` 48 of 48 graded, 0 SELF; `assert-perform` 15 of 15, row 8 graded; both Customize probes exit 0.
## 2026-09-26 · HAND-DRAW · NOT MERGE-READY

Branch `lane/handdraw`, on 3fd2543da. Plan followed: `docs/research-2026-09-26/pen-clock-on-slash-plan.md`, option A.

**Built.** `envelope.clock: "recorded" | "hand"` (`lib/stroke-schedule.ts`, default `recorded`; `lib/doc-store.ts` reads a missing field as `recorded`). A Hand Draw preset in Geometry Animation (`lib/style-system.ts`, mode `raw`, clock `hand`). One memo in `app/page.tsx` re-stamps only `t` on the processed points with `stampPenClock(points, "lognormal", { nibDiameter })`, nib from base thickness, stubs kept; it feeds `takePenMs`, `viewportStrokes` and the viewport's `rawStrokes`. `recorded` hands back the same arrays. A Clock row (Recorded / Hand) sits under Pace in `draw-in-timing-controls.tsx`. It is a row and not a third Pace pill, because Pace says how a clock is read and Clock says which one: a third pill would rule out Natural over the hand.

**Perform collision.** A performed row is stored against its clock's base slots, so a clock change would move it. Until `rebasePerformed` lands, `clockUnderTake` (`lib/stroke-timing.ts`) holds the clock while the take has a performed row: the Clock row greys out with a note saying why, and a preset or envelope edit that asks for another clock keeps the old one and says so in a toast.

**Gate.** `scripts/verify/assert-hand-clock.mjs`: 6 of 6 rows green, 6 of 6 must-fails fired (always-hand, uniform clock, strip on the recorded penMs, clock dropped on read, applies-only preset fields, no yield). R2 checked 810 logo points and 77 points of one stroke drawn with the mouse, worst difference 1.8e-12, and the reveal at 64 fractions matched exactly. Logo take: recorded 13,116 ms, hand 15,511 ms, and strip and stage agree. The memo costs 1.2 to 1.7 ms on 12 strokes. Evidence is in `docs/verification/hand-clock/`.

**Moments, from the reveal math on the logo (`film-moments.json`).** Recorded: 5.5% of the take held still, 11 holds, all 66 ms. Hand: 17.9% held, 11 holds from 140 to 489 ms, so the lifts come in different lengths. Landing: in the first 15% of a stroke's time the pen runs at 1.18x its mean speed under hand (0.96x recorded). That is **not** the slow touchdown the plan's K1 describes. Check this first.

**Not done.**
1. THE LOOK. `film-strip-authentic-hand-deskdoodles.png` cannot be read: the viewport crop is too wide for the word, and the Desk Doodles capture (`desk-doodles-draw-in.webm`) shows page chrome rather than a clear draw-in. Nobody has seen the hand yet. Crop tight to the word, look at `film-hand-*.png` against `film-authentic-*.png` at full size, then find the draw-in on `/desk-doodles`. A suspected cause for any mismatch, **not verified**: Desk Doodles squeezes the record into a 4.667 s beat (about 3.3x, per the `LIFT_BANDS_MS` comment), while `/` plays the hand's record at 1x.
2. Regressions were not run: `assert-stroke-timing-browser --grade-solid` (38), `assert-stroke-strip` (18), `assert-take-timeline` (21), `assert-motion-customize`. Hand Draw adds a sixth preset to that last gate's loop, so expect 49 rows, not 41. tsc is at the baseline of 6.
3. Timing on a 200-stroke drawing. PEN-9 (Hand Draw, then Smooth Reveal, goes back to recorded) was not gated.

**Phase 2, next lane.** Perform's `rebasePerformed` (PEN-7, the biggest risk; it replaces the hold above). Camera moves off the hand's lifts (PEN-10, stale "Turn in the lifts" keys). Inflate's shader holds under hand. Export under hand.

### 2026-09-26 · HAND-DRAW-2 · NOT MERGE-READY

Branch `lane/handdraw` on 0dcbd0d76. Stopped at the context line. **No product code changed.** Evidence and tools only.

**1. The film, re-shot.** `docs/verification/hand-clock/sheet/sheet-before.png` (numbers in `sheet-before.json`). Same head-on camera for all three (`orbitView(0, 0)`, the draw beat's own pose), each row cropped to its word's ink box and scaled to one width, 13 frames at even steps of each row's own clock, and one reveal-against-seconds chart on a shared axis. Regenerate with `FS_HEADED=0 FS_PORT=3138 node docs/verification/hand-clock/tools/film-sheet.mjs <tag>`. What I saw:
- `/` Authentic, 13.12 s: the ink grows by the same amount every frame. 1/12 shows only the D's downstroke and foot. The 11 lifts are all 55 to 66 ms, so nothing ever stops. A plotter.
- `/` Hand, 15.51 s: frames advance unevenly. At 1/12 the whole D is down (Hand spends less on the D and more on lifts). The chart shows 11 visible flats, 142 to 478 ms. **The longest, 478 ms, sits between the two o's of "Doodles"; the word space (k to D) is only 271 ms.** So the one pause that should say "new word" is not the longest.
- `/desk-doodles`, 4.67 s: same pen order, and the whole word lands in under a third of the time. The ink is the black flat nib, not `/`'s grey tube, which is style, not clock. Its lifts, scaled back to the record, run 286/233/260/143/**556**/286/**246**/193/156/183/206 ms: the word space is the longest.

**2. The landing.** Desk Doodles' clock gives the same **1.18x** over the first 15% of a stroke's time, on the same word (`tools/probe-landing.mjs`). The 15% window is too wide for a lognormal, which peaks early. Over the first 10%: Desk Doodles **0.76x**, `/` **0.86x**. The cause is the input: `/` stamps the processed resample (`app/page.tsx:757`), Desk Doodles stamps the raw trace and resamples after (`app/desk-doodles/page.tsx:175`, `:1622`). The resample moves `humanLiftsMs`' letter map, which is also what swapped the two lifts above. Stamping `/`'s raw recording and carrying `t` through `processStroke` reproduces Desk Doodles' clock exactly offline (15,554 ms, 0.76x). Not built. ⚠ Unchecked: the Desk Doodles chart row is an offline rebuild without the page's hand-feel (`wobble` roughHanddrawn, `kinematicsPass` retime defaults on, `lib/stroke-processing.ts:246`). Read the page's own processed `t` before trusting row 3's lift numbers.

**3. The speed.** It is a fit. `lib/hero-motion.ts:1523` sets the draw beat to 140/30 s; `:3866` maps the playhead to u over that beat; `:3874` hands `drawEase(u, 1.0)` (linear, `:1698`) as the reveal; the page writes it to `revealRef` (`app/desk-doodles/page.tsx:2168`), and the viewport reads it through `revealDistanceFraction` with `REVEAL_ENVELOPE_DEFAULTS` (`components/viewport-3d.tsx:11032-11035`). So Desk Doodles plays its 15.55 s record in 4.667 s (3.33x), **and under Natural (hybrid, blend 0.4, `:11013`), not Authentic.** The Hand Draw preset uses Authentic.

**Proposed, not built.** `envelope.fitSeconds` (default 0 = full length, so every other preset stays main), read only under `clock: hand`; Hand Draw sets 140/30 so the benchmark word plays at exactly Desk Doodles' speed. The memo scales `t` uniformly after the stamp. A uniform rate leaves the reveal over clock fraction unchanged, which the gate can prove. Hold it under a performed take by passing `${clock}|${fitSeconds}` to `clockUnderTake` at `app/page.tsx:699` and `:1460`. Gate rows to add: R7 clock parity with Desk Doodles (must-fail: stamp the resample), R8 fit (must-fail: fit off).

**Taste calls for Sebs.** Fit or Full as Hand Draw's default. 4.667 s for every drawing, or scale it with stroke count. Natural or Authentic under Hand, since Desk Doodles plays Natural.

**Not run:** every regression in the brief, tsc. Dev server killed by pid, `.next/` deleted.

### 2026-09-26 · HAND-DRAW-3 · NOT MERGE-READY

Branch `lane/handdraw` on 20904f226. Stopped at the context gate (151k) after the product code, before the gate and the sheet. **Built, tsc at the baseline of 6, nothing run in a browser.**

**1. Input.** The clock memo in `app/page.tsx` now stamps the RAW trace (`stampPenClock(rawStrokes)`) and carries `t` through `processStroke` with the stroke's own canvas settings, the order Desk Doodles uses. Only `t` is copied onto the stored processed points, so geometry cannot move. A stroke whose stored resample no longer has the fresh point count takes `t` by arc length (`carryTimeByArc`, `lib/stroke-timing.ts`) and is counted in `__fsClock.get().drift`. Offline (`docs/verification/hand-clock/tools/probe-rate.mjs`): on the logo, `/`'s stamp input and Desk Doodles' give identical clocks, worst |dt| 0, 12 strokes each (no sub-nib stubs on this word, and Desk Doodles' nib is `/`'s default nib), record 15,554 ms.

**2. Speed.** No global rate existed (the take's `speed` is per stroke, capture speed is Perform's), so `envelope.rate` is the one: default 1, which hands back the same arrays; `rateScaled` divides every `t` about the earliest one, under either clock. Hand Draw sets `rate: HAND_DRAW_RATE` (3.333, so the logo lands at 4,666.7 ms against 140/30 s, 0.01 ms off) and `mode: "hybrid"` (Natural). `lib/doc-store.ts` reads a missing rate as 1 and a rate outside 0.25 to 8 as 1 with a repair. A performed take holds clock AND rate (`clockKeyOf` at both `clockUnderTake` sites). A Speed row sits right under the Clock row in `draw-in-timing-controls.tsx` (`W(["envelope.rate"])`), which Customize lists because Hand Draw's `motion.envelope` names it.

**Not done, in order, for the next lane.**
1. `assert-hand-clock.mjs`: R2 now FAILS BY DESIGN (it stamps the processed points). Point it at `__fsClock.get().rawRecorded` vs `.stamped`, and add clocked x,y == recorded x,y. Add R7 parity (/'s `stamped` vs `stampPenClock(polys, lognormal, { nib, dropSubNibStubs: true })` at 64 fractions, 1e-9; must-fail `clock-stamp-resampled`, already wired in the memo), R8 longest lift = word space on both (word space = the lift with the largest x gap between the ink before and after it; must-fail `clock-stamp-resampled`), R9 logo take = 140/30 s within 16.7 ms (must-fail `clock-rate-off`, wired), R10 Authentic take sha = `47596359db80`, HAND-DRAW's committed hash (must-fail `clock-rate-leak`, wired). R5 must also cover `envelope.rate`.
2. Sheet: `FS_HEADED=0 FS_PORT=3138 node docs/verification/hand-clock/tools/film-sheet.mjs after`; row 2's chart must read Natural (mode hybrid, blend 0.4) now, not raw 0. Open it next to `sheet-before.png` and write what is seen.
3. Regressions in the brief, summary lines only. Expect `assert-motion-customize` to need a look: Hand Draw now lists one more field.

No dev server was started, no `.next/` exists.

### 2026-09-26 · HAND-DRAW-4 · NOT MERGE-READY

Branch `lane/handdraw`, 76ef66079 plus this commit. Stopped at the context gate (151k) after steps 1 to 4. Step 5 did not run, and neither the new sheet nor the after shots of the rows were opened.

**1. Gate, done.** `assert-hand-clock`: 10 of 10 rows green, 10 of 10 must-fails fired, 0 page errors. Denominators: logo 12 strokes, 1039 input points, 64 reveal samples. R2 stamps `rawRecorded` and compares it with `stamped`: 1039 points, worst 5.46e-12, reveal worst 6.66e-16. Clocked x,y against recorded: 810 points, worst 0, drift 0. The mouse-drawn stroke: 49 points, worst 0. R7, parity with Desk Doodles' own call (nib 22.58 on both): 1039 points, worst 5.46e-12. R8: 11 lifts, the longest after stroke 4 at 581 ms (next 300), which is also the widest gap. Both clocks agree, lifts worst 1.82e-12. R9: the fit gives 4666.7 ms over 252 of 283 frames, export 4666.7 ms, penMs 4666.7 ms, against a target of 4666.7 +/- 16.7. R10: Authentic take `47596359db80`, same as main. R5 now covers `envelope.rate`: 14 of 14 listed, an edit to 1x marks the field once, Reset puts back 3.333. `__fsTake.get()` has no `takeMs`, so R9 reads `getTotalDuration()` and `penMs`. The `take()` helper is unchanged so the R10 hash stays comparable. Under `clock-stamp-resampled` the longest lift moves to after stroke 6 (495 ms), the defect HAND-DRAW-2's sheet showed.

**2. Sheet, made and NOT opened.** `docs/verification/hand-clock/sheet/sheet-after.png`. The only numbers so far come from `sheet-after.json`. Row 2 (/ under Hand Draw): 4.67 s, lifts 86/70/78/43/167/86/74/58/47/54/62 ms, and the longest (167 ms at 1.80 s) is the word space. The Desk Doodles row runs 4.673 s. Before: 15.51 s, and the longest lift (478 ms) was the 7th, not the word space. Known miss: row 2's chart still reads raw at blend 0. `__styleHarness.snapshot()` has no `revealEnvelope`, so the tool falls back to Authentic. Next: read the mode off `__fsClock` or the preset, rerun, then open both sheets.

**3. Style, done, after shots not opened.** Speed was a number input with a spinner, pushed to the right edge. In Customize, once edited, the Reset mark was drawn over the input (`rows/customize-edited-before.png`). It is now pills: 0.5x, 1x, 2x and 3.33x (`HAND_DRAW_RATE`). They use the same classes as Pace and Clock, and the label is a span, so Reset sits after SPEED. A stored rate that is not on the list gets its own pressed pill. Clock already matched (pills, same Whole draw card, Reset after the label), so it is unchanged. **Taste call:** the old input reached 0.25 to 8 in 0.25 steps, and the pills reach four values.

**4. Transport, report only.** The 0.5x/1x/2x buttons (`components/viewport-3d.tsx:14483`) set `speed` (`useState(1)` at :11002, not saved with the doc). It scales the playback tick at :8210 (`ms * speed / totalDuration`) and goes into the video export at :13409, where `lib/export/frame-plan.ts:308` does `drawDurationMs = sourceMs / speed`. So it changes the preview AND the video file, but not the take: slots, strip and `exportMs` (:11295) come from the take. `envelope.rate` divides `t` before the take is built (`app/page.tsx:767`, `rateScaled`). So the two multiply and never conflict in code: Hand Draw at 2x plays and exports the logo in 2.33 s while the strip still says 4.7 s. That gap is the thing to decide.

**5. Regressions: none run.** tsc was not run on the component change. Next lane, in order: tsc (baseline 6), `assert-motion-customize` (Hand Draw lists 14 fields now), `assert-custom-presets`, `assert-stroke-timing-browser --grade-solid`, `assert-stroke-strip`, `assert-take-timeline`, `assert-perform`, `assert-key-lanes`. The stroke-timing base files are copied into the clone.

The :3138 server (pid 69413) was killed after its cwd was checked, and `.next/` is deleted.

**HAND-DRAW, merged 2026-09-26 by the controller.** HAND-DRAW-4 stopped before its regressions, so the controller ran them from the lane's own server, rebased on main `782cd8d89` (the MOTION-CUSTOM commits dropped out as already applied): `assert-hand-clock` 10 of 10, `assert-motion-customize` 49 of 49 (48 of 48 red on the must-fail, 6 of 7 presets now with Hand Draw), `assert-custom-presets` 48 of 48, `assert-stroke-timing-browser --grade-solid` 38 of 38, `assert-stroke-strip` 18 of 18, `assert-take-timeline` 21 of 21, `assert-perform` 15 of 15, `assert-key-lanes` 16 of 16, tsc 6. The first presets and strip runs failed on base files the sparse clone had not checked out; green once `docs/verification/presets` and `stroke-strip` were added. On main after the merge, from :3000: `assert-hand-clock` 10 of 10, `assert-motion-customize` 49 of 49. The sheet he judges: `docs/verification/hand-clock/sheet/sheet-after.png`, Hand Draw on `/` against Desk Doodles, same 11 lifts within 1 ms, 4.67 s. Speed is pills (0.5x, 1x, 2x, 3.33x); the old number input reached 0.25 to 8. Phase 2 is still open: Perform's `rebasePerformed`, camera moves off the hand's lifts, Inflate's holds, and the transport's 0.5x to 2x, which multiplies with `envelope.rate` in playback and export while the strip keeps its own length.

**TEXTURE-ANIM, 2026-09-26, NOT MERGE-READY.** Lane `lane/texanim` off e5cc8e73b, stopped at the context line before its gate ran. Row 87 of `docs/research-2026-09-26/animation-asks-coverage.md`.
- **Measured on main** (`docs/verification/texture-anim/measure-travel-main.txt`, 13 patterns x Rod and Inflate, logo, 5 steps of 0.5 s): Travel at its default changes 50 to 95% of ink pixels per 0.5 s on 12 of 13 patterns, and 10 to 20% on Grain. So it moves; it does not read. On a stroke ten pixels wide the pattern slides 0.6 of a feature period per step, and each step looks like the same camo reshuffled, with no landmark to track. Grain sits at the pixel scale and the Rod ink swallows it.
- **Built:** Texture Animation gets a Behaviour menu like the ASCII one: Travel (unchanged), Pulse (contrast breathes x0.05 to x3, 1.7 s), Sheen (a 245 px band of light crosses in the Direction, 1.4 s), Boil (the pattern jumps to a new offset 6 times a second, hand-drawn line boil). Direction greys out for Pulse and Boil. New field `textureAnimationType` (default travel) is in the 9 Animated Texture presets, so Customize lists it. Off forces the shader to Travel at phase 0, which is main's frame.
- **Not done:** the gate `scripts/verify/assert-texture-anim.mjs` is written but has not run its MOVES, OFF or DIFFERS rows or their must-fails (`--mutate=off-leak`, `--mutate=all-travel`). The native-scale sheet `docs/verification/texture-anim/sheet-procedural.png` is rendered and not yet looked at; the first sheet, at a third of the size, showed Pulse and Sheen reading and Boil looking like Travel in stills. Regressions not run. tsc is at the baseline of 6.
- **Next:** run the gate (about 12 minutes, `FS_HEADED=0 FS_PORT=3139`), open the sheet, cut Boil if it does not read, then the four regressions.

**TEXTURE-ANIM-2, 2026-09-26, NOT MERGE-READY.** The gate now passes 3 of 3 rows and all three must-fails fire. The four regressions and tsc did not run: the lane hit the 150k context gate first. Evidence: `docs/verification/texture-anim/`.
- **Gate, run 3** (`gate-run3.log`, 2 modes x 13 patterns x 4 types, 1512x982, :3139 headless): MOVES 104/104 cells above a bar of 882 changed px. The null (same type, speed 0) maxed at 0 over 104 cells, so the bar is the 5% floor of the smallest ink (17633), not 3x the null. Smallest cell per type: Travel 1019 (5.8%, rod:grain, the only one near the floor), Pulse 4490 (25.5%, rod:grain), Sheen 6318 (35.8%, rod:contour), Boil 3747 (21.2%, rod:grain). OFF 104/104 Off frames byte-identical to main, control 26/26. DIFFERS 78/78, worst summed change from Travel: Pulse 14543, Sheen 29399, Boil 11614.
- **Must-fails, on the final code:** `--mutate=freeze` 104/104 live cells fall to the bar (`mustfail-freeze.log`). `--mutate=off-leak` leaves 26/104 frames identical to main, the 26 Travel ones, with the control at 26/26 (`mustfail-off-leak.log`). `--mutate=all-travel` 0/78 cells differ from Travel (`mustfail-all-travel.log`).
- **Gate defects fixed, none by moving the bar.** (1) The MOVES must-fail could never fire: BAR is at least 3x the worst null, so every null sat under it by construction. Replaced by a new mutant, `texanim-freeze` in `components/viewport-3d.tsx`, which holds `uFsTexTime` at the phase with the type live. (2) The reset state cleared the phase but not the speed, so each speed-0 null leaked into the live cell after it. Run 1 graded all 104 live cells at 0 px, Travel included (`gate-run1-speed-leak.log`). The reset now sets `textureSpeed` to the default parsed from `lib/style-system.ts`. (3) The null was one pair of frames and the live cell was the min of two pairs: two statistics against one bar. Both now take four frames and score the median of three 0.5 s pairs. **Controller, judge this one:** the median is never lower than the old min. The reason is measured: the texture clock restarts at 0 on every state change, so every Pulse cell grabbed T = 0.72 and 1.31, which sit symmetric about its peak at T = 1. That pair came out 0 px, while pairs 2 and 3 changed 60 to 80% of the ink (8 Pulse cells, `superseded/gate-run2.log`). The median still fails a type that moves once and stops, and it fails freeze. (4) Under off-leak, the OFF row now also needs the baseline control at 26/26, so the red comes from the leak and not from a baseline that does not reproduce. (5) Any frame gap outside 450 to 650 ms fails MOVES.
- **App defect fixed:** Inflate woodgrain Off came out off main's bytes on all 4 types, with the control at 25/26. Two runs gave the same hash, so it was deterministic. The Sheen light was added unconditionally as `+= 0` when Sheen was off, and that changed the compiled arithmetic. It is now guarded by `if (fsSheen > 0.0)` in `lib/texture-shader.ts`, which brought OFF to 104/104.
- **Seen at native scale** (`sheet-procedural.png`, 0.5 s frames). Travel reads as the same camo reshuffled, with no landmark to track. On Rod, Pulse's change is there but subtle on the thin body. On Inflate it is plain: strong blue blotches at 0 s, nearly flat at 2.5 s. Sheen reads best on both: a white lit band sits on the k at 0 s, the D at 1.0 s, the k at 1.5 s and the e at 2.5 s. Boil looks like Travel in stills.
- **Boil in motion** (`sheet-procedural-33ms.png`, 6 frames at 33 ms, captured in-page on the animation frame). Travel changes 22 to 23% of the ink every frame, a steady slide. Boil holds, then snaps: 84.7% then 0, 0, 0, 0 on Rod, and 0, 74.6%, 0, 0, 0 on Inflate. The frames show the same thing: on Inflate, Boil's +0 and +33 ms frames differ and +33 to +167 are identical. Kept. **His call:** each jump re-rolls the whole pattern (a random offset within one period either way), so Boil reads as a 6 Hz flicker, while drawn line boil is the same drawing wobbling. A jump of about 0.15 period would keep the pattern and wobble it. I did not change it without his eye on it.
- **Grain** (`sheet-grain.png`, plus the MOVES cells), share of ink changed per 0.5 s on Rod and Inflate: Travel 5.8% and 8.1%, Pulse 25.5% and 17.8%, Sheen 54.9% and 57.3%, Boil 21.2% and 18.8%. By eye, Sheen is the only type that plainly shows on Grain, and it shows as light passing, not as grain. Travel does not show on either mode. Pulse and Boil do not show on Rod. On Inflate they only flicker a few dark streaks on the D and the k.
- **Not run:** `assert-custom-presets` (48), `_probe-customize-coverage` and `_probe-customize-leaks`, `assert-stroke-timing-browser --grade-solid` (38), `assert-motion-customize` (41), tsc at 6. The two sheets were rendered before the woodgrain guard. The guard only touches pixels with no sheen, so they stand.
- **Next:** run the four regressions and tsc from a fresh lane on :3139 with `FS_HEADED=0`, after the sparse-checkout and base-file copy in this row's brief. Then get his eye on Boil's jump size.

**TEXTURE-ANIM-3, 2026-09-26, NOT MERGE-READY.** Boil is done and passes every cell. The full gate run failed one Travel cell, rod:grain, which this lane did not touch and which sits on the 5% floor: 3.8%, 15.5% and 7.3% of its ink across three runs of the same code (TEXTURE-ANIM-2 got 5.8%). Merging needs a ruling on that cell, not more Boil work. Evidence: `docs/verification/texture-anim/`.
- **Boil is now line boil.** The pattern loops through three fixed offsets, A B C, about a quarter of a feature period apart (steps of 0.23, 0.27 and 0.26 period, each a different way, centered on the rest position), 7 steps per unit of texture time, 8.4 a second at speed 1. It replaces a re-roll to a random offset anywhere within one period. Three poses and 8.4 a second, not four poses at 6 to 8: four poses at 7 a second loop every 0.56 s, so the gate's frames 0.5 s apart mostly land on the same pose and a boiling cell grades as still. Three at 8.4 a second differ at any frame gap from 0.48 to 0.71 s.
- **Seen** (`sheet-boil-inflate-33ms.png`, Inflate, procedural, 6 frames at 33 ms, Travel on the top row for reference). It wobbles now instead of flickering. Across the step the dark blotches stay put (top of the k's stem, the e's lower left, the D's stem) and only their edges shift. The old re-roll put a different camo in the same letters. Ink changed per step: 71.7% and 71.1%, with holds at 0 (the re-roll changed 74.6% on Inflate and 84.7% on Rod). The number barely moved because a quarter-period nudge still moves nearly every blotch edge, so a changed-pixel count cannot tell a wobble from a flicker. Only the frames can.
- **Gate, run 4** (`gate-run4.log`, 2 modes x 13 patterns x 4 types): MOVES 103/104 above the bar of 882 px, null max 0. The miss is rod:grain:travel at 674 (pairs 662, 748, 674). Boil 26/26, smallest 2947 (16.7%, rod:brushed), grain 20.8% on Rod and 17.2% on Inflate. OFF 104/104 byte-identical to main, control 26/26. DIFFERS 78/78, and Boil's worst summed change from Travel went from 1161 to 12702.
- **Must-fails, all three fire:** freeze, 104/104 live cells fall to the bar. Off-leak, 26/104 Off frames stay identical to main, control 26/26. All-travel, 0/78 cells differ from Travel. The off-leak and all-travel runs also graded MOVES 104/104, rod:grain:travel included.
- **Regressions:** `assert-custom-presets` 48 of 48 graded. `_probe-customize-coverage` and `_probe-customize-leaks` exit 0, 0 leaks. `assert-stroke-timing-browser --grade-solid` 38 PASS, 0 FAIL. `assert-motion-customize` 41 of 41, 40 of 40 must-fail rows red, corpus 5 of 6: this head has 41 rows, not the 49 the brief named. tsc 6 errors, the baseline 6, none in files this lane touched.
- **Gate change:** `--modes=inflate` runs one mode, for the strip. Nothing else in the gate moved.
- **Next:** rule on rod:grain:travel. Either Travel takes a bigger step on Grain or the gate grades that cell over more pairs. Then his eye on Boil at speed 1 in the app.

**TEXTURE-ANIM, merged 2026-09-26 by the controller.** Controller's call on the one red TEXTURE-ANIM-3 left: Travel on Rod Grain scored 3.8, 15.5 and 7.3% of the ink on three runs of the same code, against a 5% bar. Travel is main's motion, unchanged, and its tempo is shared by 9 presets, so its visibility is his call. MOVES now grades the three new types and prints Travel's cells as MAIN, never PASS; the freeze must-fail still counts all 104 cells, Travel included. On main after the merge, from :3000: `assert-texture-anim` MOVES 78 of 78, OFF 104 of 104, DIFFERS 78 of 78; `assert-custom-presets` 48 of 48; `assert-motion-customize` 49 of 49; `assert-hand-clock` 10 of 10; both Customize probes exit 0. His calls: Travel's tempo (hard to see on Grain), and whether Boil's three-offset wobble reads as boil.
### 2026-09-26 · PANEL-2 · NOT MERGE-READY

Branch `lane/panel`, on e65faf7a6. No PANEL row was in this file on the lane or on main, so this note stands on its own.

**What I saw first.** Probe on :3138 with the 12-stroke logo, closed and open, at 1280x800 and 1512x982, all four shots opened. At 1280x800 the transport row ran 4 px past the dock's right edge (618 px of content in a 614 px row) and Debug sat across the border, closed and open. At 1512 it fit exactly. Closed, all 12 bars showed at both sizes. Open, 6 of 12 showed, the sixth under the band's fade, because PANEL floored the band at 72 px. The open Draw-in body showed 144 of its 706 px at 1280 and 245 of 651 at 1512.

**Fix.** `components/viewport-3d.tsx`: the transport row wraps (`flex-wrap gap-x-2 gap-y-1.5`, marked `data-animation-transport`), and the scrubber takes `min-w-16`, so it gives up width before any control can leave the dock. At both sizes the row still sits on one line. With Draw-in open, the dock may take 66% of the column instead of 55%, and the strip's floor is `stripBandPx(n)` plus 4rem. `stripBandPx` is a new export in `components/stroke-strip.tsx`: up to 12 rows at the 12 px pitch, the height the closed strip already draws. The section's room now comes out of the 3D view, never out of the strip: at 1280 open the 3D view drops from 351 to about 207 px tall.

**After, opened.** 12 of 12 bars whole in all four states, Debug 12 px inside the border, body 143 px at 1280 and 263 px at 1512. The Draw-in body still scrolls, since 706 px of controls do not fit beside the strip and the 3D view in an 800 px window. It scrolls in its own box, which ends at the note bar's hairline. Nothing sits under the note bar. Shots: `docs/verification/animation-panel/{closed,open}-{1280x800,1512x982}.png` and the `-dock-` crops.

**Gate** `assert-animation-panel`: 7/7 rows, 8/8 must-fails fired, 30 controls. New R6: every transport-row control inside the dock, 9/9 in each of the 4 states. New R7: every strip row whole, 12/12 in each. R6's must-fail puts back PANEL's nowrap row with the range input's default floor, and Debug lands outside at 1280, closed and open. R7's puts back the six-row floor under a 55% dock: 6/12, open, at both sizes.

**Timing locators**, moved to `[data-animation-drawin]` and to the region named "Draw-in timing":
- drawin-timing 23/25. Red: "Escape dismisses it", a popover bar the section never had. That one needs his call: Escape closes the section, or the bar retires. Also red: the mid-pass sample CONTROL (playhead 1.0 after 79 ms of a 1680 ms pass), a clock sample, not layout. The one literal I changed: `plain === "Timing"` is now `"Draw-in"`, the header's name.
- export-window 38/39. Red: "not one raster comparison compared two DIFFERENT-SHAPED frames" (579 comparisons, 94 mismatches, 46 grabs at 799x1171). Not traced, and I do not have main's result for it.
- form-channel 8/8. camera-frames-the-drawing 8/8; it had no live Timing locator, only a comment, so it is untouched. debug-surface-fenced: 4 rows pass, exit 3, because the production arm needs `--prod-port` and was not run.

**Regressions.** take-timeline 21/21, motion-customize 49/49, hand-clock 10/10, tsc 6 (baseline).
- stroke-strip, key-lanes, perform, custom-presets and stroke-timing-browser all threw in `scripts/verify/lib/undock.mjs`: "canvas 755.5x805.3 does not fill the dock host's content box 756x890". PANEL caused this. The dock now mounts before the first stroke, and undock floats only `[data-take-dock]>:has([data-take-timeline])`, so the empty dock takes 85 px of the host. The fix is one line, outside my lane: `${HOST}>:is([data-animation-panel],:has([data-take-timeline]))`.
- With that line patched locally, then reverted and not committed: key-lanes 16/16, perform 15/15, custom-presets 47/48, stroke-strip 16 pass 1 fail, stroke-timing-browser: 34 PASS · 4 FAIL  (engines rod, inflate, extrude, solid).
  - custom-presets' red: "untouched page: screenshot byte-identical to main 347e22e6b". PANEL changed the untouched page, since the dock now shows before any stroke, so the baseline gets re-recorded once he rules the dock in.
  - stroke-strip's red: a sixth Timing locator, `getByRole('button', { name: /^Timing/ })` in `assert-stroke-strip.mjs`, which was not on my list.
  - stroke-timing-browser's 6a rows did NOT RUN: `docs/verification/stroke-timing/base-1051bc8e1.json` and `base-57a97b4d1.json` are missing from the sparse clone.

**Before it merges:** the undock line, the stroke-strip locator, the custom-presets baseline, his call on the Escape bar, the stroke-timing bases copied in and re-run, and export-window's raster row traced against main.

### 2026-09-26 · PANEL-3 · NOT MERGE-READY

Branch `lane/panel`, from 80fc44281. Server :3138 from this clone, headless, one browser at a time. Not merge-ready: export-window's raster-shape row is red here and green on main, so PANEL caused it and it is not traced yet. Two more reds sit outside this lane: stroke-strip's sixth Timing locator and custom-presets' untouched-page baseline, both named by PANEL-2. drawin-timing's mid-pass row is green here and red on main, so it is not PANEL's.

**undock** (`492be44ce`). The dock now renders whenever the host docks, `(docked || strokeCount > 0) && !chromeless`, so the panel is on the page before the first stroke with no take strip in it. The float now keys on `[data-take-dock]>:is([data-animation-panel],:has([data-take-timeline]))`, and step 1 checks an already-mounted panel before it returns: if the host holds a `[data-animation-panel]` child, the panel selector must match it and its computed position must be absolute or fixed. Every earlier check stays: stylesheet landed, canvas fills the host, 755x890 at 1512x982, panel floated when the strip mounts. Through `_probe-customize-delete.mjs`: clean exit 0, "host floated: canvas 755.5x890 ... panel already mounted, position absolute" and "panel floated: position absolute, canvas 755.5x890". `UNDOCK_MUTATE=css` exit 1, "the stylesheet did not land ... padding-bottom 64px". `UNDOCK_MUTATE=selector` exit 1, "the panel selector ... matched nothing, though [data-take-dock] holds a [data-animation-panel] child". The selector arm now fails at step 1 instead of waiting for the strip.

**The five gates undock crashed**, each logging "panel floated":
- stroke-strip 16 pass, 1 fail, exit 1: the gate threw on `getByRole('button', { name: /^Timing/ })`, the sixth Timing locator. Rows after the throw did not run, so 17 of the expected 18 were graded. Not this lane's file.
- key-lanes 16/16. perform 15/15.
- custom-presets 47/48: "untouched page: screenshot byte-identical to main 347e22e6b" (15535493216142a4 vs a866e4b1f4b13e51). The dock showing before any stroke changes the untouched page; the base gets re-recorded once he rules the dock in.
- stroke-timing-browser --grade-solid, first run 37 PASS 1 FAIL: solid 6a NOT RUN, `base-62358b9ff.json` missing. Copied it from main with `cp -p` (with base-1051bc8e1 and base-57a97b4d1) and re-ran: 38 PASS · 0 FAIL  (engines rod, inflate, extrude, solid)
  - 38 PASS · 0 FAIL  (engines rod, inflate, extrude, solid)

**drawin-timing** on the lane: ALL 25 DRAW-IN TIMING ASSERTIONS PASS
- "Escape dismisses it" is RETIRED, and the reason is in the gate. It tested the Timing popover, which no longer exists. Draw-in is a disclosure in the dock, `aria-expanded` on its header, and nothing covers the canvas, so Escape has nothing to dismiss; viewport-3d binds Escape only to the PNG and video popovers. Retiring a row for a removed control is not loosening it. In its place: "the Draw-in header closes it again", region gone and `aria-expanded` false. It leaves the section shut, as Escape used to, so every later row starts from the same state. Its red half is the same `!dlg.isVisible()` predicate that went red in PANEL-2's run; the `aria-expanded` half has no must-fail run.
- Lane mid-pass row: PASS  CONTROL · that sample landed mid-pass, so the identity above was read while the clock was still moving , playhead 0.307917 after playing 528ms of a 1680ms pass · head before play 0.000000 · playing at the sample: true (sampled ON the page's own playhead, not a wall-clock sleep)
- Main (:3000, d6f6ca7d1): 1 of 25 DRAW-IN TIMING ASSERTIONS FAILED
- Main mid-pass row: FAIL  CONTROL · that sample landed mid-pass, so the identity above was read while the clock was still moving , playhead 1.000000 after playing 50ms of a 1680ms pass · head before play 0.999994 · playing at the sample: true (the playhead never entered 0.3..0.5) , AT OR PAST THE END. The pass finished before the sample was taken, so this run is measuring a stalled or overloaded page and the identity
  - FAIL  CONTROL · that sample landed mid-pass, so the identity above was read while the clock was still moving , playhead 1.000000 after playing 50ms of a 1680ms pass · head before play 0.999994 · playing at the sample: true (the playhead never entered 0.3..0.5) , AT OR PAST THE END. The pass finished before the sample was taken, so this run is measuring a stalled or overloaded page and the identity

**export-window** raster-shape row, "not one raster comparison compared two DIFFERENT-SHAPED frames":
- Lane: assert-export-window: 38 PASS · 1 FAIL. Row: FAIL  not one raster comparison in this run compared two DIFFERENT-SHAPED frames (explainer 35)  ,  585 comparisons, 96 mismatches · grabs {"799x1171":46}
  - FAIL  not one raster comparison in this run compared two DIFFERENT-SHAPED frames (explainer 35)  ,  585 comparisons, 96 mismatches · grabs {"799x1171":46}
- Main: assert-export-window: 39 PASS · 0 FAIL. Row: PASS  not one raster comparison in this run compared two DIFFERENT-SHAPED frames (explainer 35)  ,  582 comparisons, 0 mismatches · grabs {"799x1171":46}
- Main is green on this row and the lane is red, so PANEL caused it. Not traced by this lane: the 40-call budget ran out with the main comparison as the last step. The likely path, unconfirmed, is the dock now mounting before the first stroke and growing with `stripBandPx(n)` as strokes land, which resizes the raster mid-run, the case the gate's own header names (799x1508 -> 799x1468).

**debug-surface-fenced production arm: NOT RUN.** It needs a real `next build` served by `next start`, and `next build` in this clone writes the same `.next/` the dev server on :3138 was serving the other gates from, so it could only run after that server was killed, as its own build, serve and gate step. The 40-call budget did not leave room. Next lane: `rm -rf .next && node_modules/.bin/next build && node_modules/.bin/next start -p 3138`, then `FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-debug-surface-fenced.mjs --prod-port=3138`.

Main's gate runs: restored docs/verification/export-window/real-button-films.png  Dev server on :3138 killed by exact pid after its cwd was confirmed as this clone; `.next/` deleted. tsc not run: only `.mjs` and this note changed.

### 2026-09-26 · PANEL-4 · NOT MERGE-READY

Branch `lane/panel`, from 1520ce262. Server :3138 from this clone, headless, one browser at a time. PANEL-4's three rows are green: export-window 39 of 39, stroke-strip 18 of 18, animation-panel 7 of 7 with 8 of 8 must-fails fired, key-lanes 16 of 16. Still not merge-ready for three reasons this lane did not close: custom-presets' untouched-page row (47 of 48) waits on his ruling on the dock, debug-surface-fenced's production arm is still NOT RUN, and drawin-timing was not re-run after the Escape change below.

**export-window, the raster-shape row.** It counts every pixel comparison between two frames of different sizes. An instrumented copy of the gate named each one: all 96 were `tailCensus` (assert-export-window.mjs:1067) reading §D's Vanish films at 798x558 against §D's empty page, a Grow film's frame 0, at 798x544. The cause is PANEL's Draw-in section. The gate's `clickWindow` opens Draw-in, clicks a Window pill, and presses Escape. Escape closed the Timing popover on main and did nothing to the section here, so Draw-in stayed open for every §D film. Below its 66% cap the dock is as tall as what the section shows, so the canvas, and the film, changed height when Grow switched to Vanish. Main's popover floated over the canvas and never resized it.

Fix, components/viewport-3d.tsx:13765: while Draw-in is open, Escape shuts it. After: 39 PASS, 0 FAIL, 585 comparisons, 0 mismatches, and §D's films are 798x1170, the same size as §B's film from the 799x1171 canvas. Every §D film now shares one shape. Main's own §D size was not measured in this lane.

**stroke-strip.** The sixth Timing locator, line 498, now reads `[data-animation-drawin]`, the Draw-in header. 18 PASS, 0 FAIL; the row it gated, "7b Timing popover: the same stroke, speed 2 halves its slot", passes with length 1764.0 to 882.0.

drawin-timing retired "Escape dismisses it" because Escape had nothing to dismiss. Escape now shuts the section, so that reason no longer holds and the row can come back. Not this lane's file.

tsc: 6 errors, all in lib/geometry-engines.ts, the known baseline; 0 in viewport-3d. Tracked gate outputs restored. Dev server killed by exact pid after its cwd was confirmed; `.next/` deleted.

### 2026-09-26 · PANEL-5 · NOT MERGE-READY

Every row PANEL-5 owns is green. Two items carry over from PANEL-4 and were not run here: custom-presets' untouched-page row (47 of 48, waits on his ruling on the dock) and debug-surface-fenced's production arm (NOT RUN). Server :3138 from this clone, headless, one browser at a time.

**The fix, components/viewport-3d.tsx.** With Draw-in open the dock is `h-[66%]` instead of `max-h-[66%]`, and the section body grows into it and scrolls. No option inside the section can move the canvas now; opening and closing it still does. With the logo's 12 strokes at 1512x982 and 1280x800 the old dock already sat at its cap, so those sizes render as before: canvas 756x269 and 640x207 open. The jump lived under the cap. With 2 strokes at 1600x1500 the old dock took the canvas to 800x545, 800x559 and 800x534 across the pills; it is 800x445 throughout now. The cost: under the cap the open dock is taller than what the section shows, and the canvas gives up that room.

**assert-animation-panel, R8.** Draw-in open, it clicks all 4 Window pills and all 5 Order pills, then Grow and As drawn again, 11 clicks per scene in 5 scenes (logo at 1512x982, 1280x800 and 1600x1500; 2 strokes at 1512x982 and 1600x1500), and reads the canvas box after each. A pill that is missing, or not pressed after its click, fails the row. Must-fail: PANEL-4's content-sized dock put back by a style tag; it fires only when every pill landed AND the canvas took more than one size. `PANEL_MUTATE=dock` runs the real row against that dock. On the first run the must-fail did NOT fire: with the logo the old dock sits at its cap, so nothing moved. The 2-stroke scenes are what let it see the defect. Result: 8 of 8 rows, 9 of 9 must-fails fired. Screenshots `docs/verification/animation-panel/drawin-open-{grow,vanish}-{1512x982,1280x800}.png`, opened: within each pair the canvas box and the dock's top edge are the same. They are not committed.

**drawin-timing.** The Escape row is back, pointed at the section: Escape closes it, the region is hidden and `aria-expanded` is false. PANEL-3's header row stays and now reopens and closes the section. 25 of 26; the one red is the mid-pass row, the same row that is red on main (24 of 25 per the dispatch). The lane has one row more than main: the header row.

**export-window.** 39 of 39 on the lane and 39 of 39 on main (:3000, read-only, its outputs restored with git checkout). §D film with Draw-in closed: 798x1170 on the lane, 798x1170 on main.

**Regressions.** key-lanes 16 of 16, stroke-strip 18 of 18, perform 15 of 15, take-timeline 21 of 21.

tsc: 5 errors in lib/geometry-engines.ts (the baseline) and 1 in lib/dd-engine/handFeel.ts, where `perfect-freehand` is missing from this sparse clone's node_modules; 0 in the files PANEL-5 touched. Tracked gate outputs restored. Dev server killed by exact pid after its cwd was confirmed; `.next/` deleted.

**PANEL, closed out by the controller, 2026-09-26.** `assert-debug-surface-fenced` with its production arm: dev on :3138 from this clone, `next build` plus `next start` on :3140 from a scratch worktree of 71b837383 (removed after). 8 of 8: Debug is in dev and opens the real panel; the production build has no Debug button, no substrate readout, and all three window harnesses undefined. The row labels still say "Timing present"; PANEL-2 pointed that locator at the dock's Draw-in header, so the label is stale, not the check. The one open presets row (untouched page screenshot against main 347e22e6b) is the intended change, the dock now showing before the first stroke; the controller re-records that base from main after the merge.

**PANEL, merged 2026-09-26 by the controller.** On main after the merge, from :3000: `assert-animation-panel` 8 of 8 (9 of 9 must-fails, 30 popover controls); `assert-custom-presets` 46 of 46 graded plus 2 SELF against the new base 5519dba0f; `assert-export-window` 39 of 39; `assert-drawin-timing` 26 of 26; key-lanes 16, perform 15, stroke-strip 18, take-timeline 21, stroke-timing --grade-solid 38, motion-customize 49, hand-clock 10. The drawin-timing mid-pass row read red on main earlier tonight (24 of 25) and green now with no change to its code path: it is flaky, not fixed. Open: that row's flake, and the "Timing present" label in debug-surface-fenced, which now names the Draw-in header.

**K1 · the key path model, lane/keys1, 2026-09-26. MERGE-READY.** Node only, nothing on screen changed. Every numeric style value can now hold keys. `KEYABLE_PATHS` is walked from `DEFAULT_STYLE_STATE`: 38 of 38 numeric leaves, each with a row in the new `STYLE_RANGES` table in `lib/style-system.ts`. The other 43 fields are left out by name with their reason: 40 strings and booleans (colours and modes among them), 2 lists, 2 nulls. `STYLE_RANGES` is typed as a full record of the numeric paths, so a new numeric field without a row fails tsc. A key outside its range, or a curve that swings outside it between two in-range keys, is refused with its reason, never clamped. `acceptKeys` validates once on write and returns a frozen copy the samplers trust. `styleAt` samples every keyed path and hands back the same object when nothing style is keyed. `loopPhaseAt` is the running sum of a keyed speed, so a speed key never jumps a loop. Gate `assert-key-paths.mjs`: 7 of 7 rows (PATHS, SLIDERS, SAMPLE, UNKEYED, RANGE, EXISTING against main 747af8fa0 at 1024 samples, PHASE with speed times time as its must-fail: 131 jumps against 0), 8 of 8 mutants caught. `assert-keyframes` 16 of 16 with 21 of 21, `assert-width-keys` 12 of 12 with 9 of 9, tsc at the baseline of 6. Found on the way: `stackAnimationSpeed` is signed (the slider sets the size 0.1..3, Reverse sets the sign), so its range is -3..3 and a key may cross 0 to reverse the loop. Open for K2: `lib/doc-store.ts` calling `acceptKeys` on load and save (the plan puts it in K1, the brief did not give me the file); the viewport reading `styleAt` and `loopPhaseAt`; the sliders reading `STYLE_RANGES` instead of their inline bounds (the SLIDERS row holds them equal until then); whether `ditherLevels` and `asciiCellSize` round a sample that falls between whole numbers; take-side motion fields (`drawIn.overlap`) are not keyable yet.
### CURVE-2 · 2026-09-26 · NOT MERGE-READY

Lane `lane/curve` in `~/.fs-lanes/curve`, rebased clean onto main 45ed049fc: no conflicts, no file resolved. Custom is the fifth ease on the whole-draw ease (dock Animation tab, under Ease over the whole draw) and on the selected stroke's ease. It opens the key lanes' `CurveEditor` inline, seeded from the preset, writes nothing until a drag, then writes the `bezier` kind. Overshoot CLAMPS at 1: past 1 there is no ink left, and passing 1 then settling back would un-draw the last stroke's tail. A curve that turns back down holds at its peak, so the pen pauses instead of erasing.

`assert-drawin-curve`: 18 pass, 0 fail, 8 must-fails fired. Fixed on the way: the draw-in summary crashed the viewport on any curve ease (`REVEAL_EASES.find` came back empty); the gate dragged an editor scrolled out of view and wrote nothing; the editor's 430px numbers row ran past the 315px column (`CurveEditor` now takes `fit`). tsc at the baseline of 6.

Regressions: motion-customize 49 of 49, hand-clock exit 0 with 10 of 10 must-fails, take-timeline 21, stroke-strip 18, key-lanes 16 of 16, stroke-timing-browser `--grade-solid` 38.

BLOCKER: `assert-animation-panel` 7 of 8. R1 hashes every control's `aria-pressed` in the dock section, and the Custom pill is a 31st control against main's 30, so every step's hash moves. The draw-in state should be unchanged, but that is not proven. Next: run R1 with `[data-ease-custom]` left out of `ctl` and expect 30 of 30 hashes equal to main, then rebaseline after merge. Screenshot `docs/verification/drawin-curve/custom-editor-1512x982.png` was retaken after the fit fix and not opened again; row 3c proves the fit.

**CURVE, merged 2026-09-26 by the controller.** The controller changed `assert-animation-panel` R1 to fingerprint main's 30 controls and leave out `[data-ease-custom]` and `[data-ease-curve]`, the new Custom pill and its editor; the draw-in, window, schedule and duration in the same snapshot still catch any state change. On the lane's own server: 8 of 8, 9 of 9 must-fails, 31 found and 30 of 30 writes equal to main. On main after the merge, from :3000: `assert-drawin-curve` 18 of 18; `assert-animation-panel` 8 of 8; `assert-motion-customize` 49; `assert-hand-clock` 10; key-lanes 16; stroke-strip 18; take-timeline 21; stroke-timing --grade-solid 38. Overshoot clamps at 1, since passing 1 would un-draw the last stroke.
**LETTERS, 2026-09-26. NOT MERGE-READY.** Measured, not fixed. The lane stopped at the context line before touching `lib/hero-motion.ts`. New gate `scripts/verify/assert-letters.mjs` is red on today's code, 6 of 10 rows: letters overlap their neighbour past rest on 209 of 246 cascade frames (worst 9 px, pairs 1|2 2|3 3|4 5|6 9|10); the word's width is off rest by up to 13% on 217 of 217 frames; 0 of 11 letters land at yaw 0 (all at 30); 1 of 11 is back on its rest box. The model never turns two letters at once (worst 1 of 11 over 246 frames), so what he saw as several at a time is a landed letter sliding into the next. Two instrument rows are also red (C4, C5) and need fixing first. Next steps and the fix spec: `docs/verification/letters/LOG.md`.

**LETTERS-2, 2026-09-26. NOT MERGE-READY.** The turn is fixed in `lib/hero-motion.ts`: each letter turns on its own centre and lands at yaw 0 on its rest box, one at a time, then the word turns to 30 deg as one (new `letterWordHoldSec` 14 fr, `letterWordTurnSec` 18 fr). After film, `assert-letters`: L3 0 of 159 frames off width, L4a 11 of 11 at yaw 0, L4b 11 of 11 home, C4 10 of 10 pairs caught with 0 of 10 false, C5 62 of 62. Still red: L1 4 of 189 frames (the anticipation squash releasing through flip 1; model worst 1 letter) and L2 75 of 189 frames, worst 6px on 5|6 and 6|7, with the d's own box suspect. Regressions (7 hero gates, flip-pose) not run; tsc 6. Next steps in `docs/verification/letters/LOG.md`.

**LETTERS-3, 2026-09-26. NOT MERGE-READY.** Two things block it. The regressions never ran: the lane hit the context gate at 153k before the 7 hero gates, `assert-flip-pose` and tsc. And L2 is still red on o|o at 2px, which is the landed solid reading 1px fuller than the flat ink, not a slide. The o|d 6px was the instrument (the d's box was its 7px stem), and it is fixed along with how every letter's box is measured. C1 now fails an undersize box (C6 is its must-fail), and L1 counts yaw turning (C7 is its must-fail, 10 of 10). After film: 11 of 12 PASS. Before film: 7 of 12, red only on the L rows. Film: `docs/verification/letters/before-after.mp4`. Sheet: `docs/verification/letters/sheet-compact.png`. Next: the regressions, then his call on L2's tolerance. Details in `docs/verification/letters/LOG.md`.

**LETTERS-4, 2026-09-26. NOT MERGE-READY.** L2 is fixed without touching the tolerance. A letter drawn as a solid is now compared with the same letter at rest as a solid (f370, every letter landed at yaw 0), with at most 1px of outward credit per edge. After reads 0 of 189 frames and the before film stays red at 14px. The 3px must-fail found an older blind spot, so C4 is red and the gate reads 11 of 12. The solid arm catches 20 of 20. The flat arm catches 18 of 20 and misses 3px on 1|2 and 6|7 (each read 1px, both edges hidden in touching margins); the gate before this change missed them too. Hero gates, `assert-flip-pose` and tsc were NOT RUN: the lane stopped at the context line. Next: per-row edge shifts for the flat arm, then the regressions. Log: `docs/verification/letters/LOG.md`.

**LETTERS-5, 2026-09-26. NOT MERGE-READY.** The regressions ran on the lane (:3138) and on main (:3000), diffed with timings and repo paths stripped. Main exits 1 on all eight gates as well, so a red both sides share is old. Identical: `assert-hero-turn` (7 of 8), `assert-hero-return` (10 of 15), `assert-hero-hold` (7 of 11), `assert-motion-paste` (3 of 7) and `assert-hero-word-legible` (42 of 47, only the port line differs). `assert-hero-options` regresses, 35 of 41 against main's 40 of 41, and all five new reds are letter by letter (O5): 55 pairs of cascade beats overlap (main 0), the last letter stops on frame 390 past the clip's 356, the "Free Stroke Labs" clip runs to 432 (main 397), the 10 quick flips draw 10 different pictures, and letterByLetter holds its payoff 1.23s against the 1.7s floor. `assert-carve-graze` loses one row: the frame at t 7.467 reads 2.17% worse, over the 1.4% bar, where main passes. The lane renders those frames with different ink (min 104552 against 102173) and a lane rerun reproduced the result exactly; no row names a letter, so the cause is not traced. `assert-hero-carve` gives no pixel verdict on either side: with main's two captures copied in by `cp -p`, both read them as stale (09-25 03:11), so its pixel half ran nowhere. `assert-flip-pose` 8 of 8, tsc 6 errors. bc130bad8 (assert-letters only) landed in this clone mid-run from another writer.

**LETTERS-6, 2026-09-26. NOT MERGE-READY.** Stopped on a conflict between his rulings; no code change. All five O5 reds in `assert-hero-options` (35 of 41 on 2555daa93) come from writing the word's turn into every letter's own yaw. Two cannot pass at any timing: the rows say beats never overlap and every letter settles at 30 deg in its own yaw with the word's yaw parked, so each letter must reach 30 on its own beat; the 09-26 ruling lands each at 0 and turns all 11 together on frames 372 to 390, so all 11 windows end on 390 (55 of 55 pairs overlap) and the 10 quick flips have 10 lengths (10 pictures). His call: edit those two rows to end each window at its landing, or land at 30 as on main. The other three (last flip 390 against clip 356, typed word 432 against 398, payoff 1.23 s against 1.7) pass if the word's 32 fr move inside the clip, which makes the film 1.07 s longer; not built. Carve-graze t 7.467 is frame 224, the s just off its edge in the cascade; not traced to pixels. Details: `docs/verification/letters/LOG.md`.

**LETTERS-7, 2026-09-26. MERGE-READY, with one carve-graze red named below.** His three calls (2026-09-26), call 1, built. `lib/hero-motion.ts`: the word's 14 fr hold and 18 fr turn run inside the cascade clip (`cascadeClipSec` adds `letterWordBeatSec`; `letterWordYaw` starts at emerge + `cascadeSec` + hold), so the O5 film is 508 fr, 1.07 s longer. `assert-hero-options`: the two superseded O5 rows (CASCADE, DRAWN IDENTICALLY) grade each letter from its beat to its landing at yaw 0, no overlapping windows, landed letters still until the last one lands, then one shared word yaw; both cite the ruling. Lane 40 of 41; the one red is main's old "solid first opens on the object and ends on the drawing", unchanged; 20 of 21 controls, the same miss as main. The updated rows on main's model (f519bf074, model-only gate): 38 of 41, both rows red, "letter 0 holds 30.000 deg in its own yaw". `assert-letters` live on :3139: 12 of 12 (its word-turn start moved with the model). Turn, return, hold, word-legible, motion-paste on :3139 against :3000: identical output. tsc 6, unchanged. Carve-graze: lane 3 reds, main 2. The extra one is the per-frame row at t 7.467 (fwidth 801 against prior 784, 2.17 %). At f224 the model puts the s at 32.1 deg on the lane and 51.4 deg on main, |cos yaw| 0.847 and 0.624, both outside the carve band (0.28 to 0.42), because the gate's six times are hardcoded from the 08-04 film. The letter change moved the s, as ruled; the red is the gate grading a frame with no graze in it, and the fix is carve-graze predicting its frames from the model, outside this lane. Film `docs/verification/letters/before-after.mp4` (311 fr, f152 to f462, 944x880, main on top) and `sheet-compact.png` (10 moments). Details: `docs/verification/letters/LOG.md`.

**LETTERS-7 CARVE, 2026-09-26. NOT MERGE-READY: the carve-graze red at f224 is real, not a timing miss.** `assert-carve-graze` no longer hardcodes its six seconds. It asks the model (`sampleLetters`) for the frame where the `s` (letter 2) turns edge-on and samples three frames before it to two after. A new row checks the six against the model: every sample must be a frame where the `s` is turning, and every frame the model puts the `s` inside the carve band must be sampled. The premise did not hold for this window. The letter change adds its 1.07 s after the cascade (land moves from 11.867 to 12.933 s), so the `s` keeps the same clock on both models: apex f222, samples f219 to f224, t 7.3 to 7.467, equal to the old array on main (f519bf074, the same `hero-motion.ts` main HEAD e8e526576 serves) and on the lane. On :3000 the old and new gate give bit-identical counts at all six frames and the same 2 reds (band sum +0.63 %, known-bad A); the new row passes. On :3139 old and new are bit-identical too: 3 reds, band sum +0.95 %, known-bad A, and f224 at prior 784 against fwidth 801, +2.17 % (main 990 against 993, +0.30 %). What changed at f224 is the pose, as ruled: the `s` now lands to 0 deg before the word turns instead of settling at 30, so it reads 34.6 deg on the lane against 53.1 on main, |cos yaw| 0.82 and 0.60, both outside the band (0.28 to 0.42), so the carve runs at full on both. Band frames are f221 and f223 on the lane, f221 on main, all sampled. So the gate was grading the right frame; the regression is the letter change's, 17 counts on one full-carve frame, and the band sum is red on main as well. Must-fail: `--shift-sample=5:10` moves f224 to f234, where the `s` is still, and the row fails with exit 1 on both models; `--shift-sample=0:-10` fails the same way. `--times-only` prints the derivation without a browser. One `--model-rev` run threw once and passed on rerun; not chased.

**LETTERS, merged 2026-09-26 by the controller, with one new red kept visible.** His ruling ("his three calls"): letters land dead on, one at a time, then the word turns as one, inside a clip 1.07 s longer. On main after the merge, from :3000: `assert-letters` 12 of 12; `assert-hero-options` 40 of 41, the one red main's old "solid first" row, unchanged; `assert-flip-pose` 8 of 8. `assert-carve-graze` keeps main's two old reds (OVER THE BAND, KNOWN-BAD A) and adds one: at t 7.467 s (f224) the shipped divisor reads 801 against prior 784, 2.17% worse against a 1.4% bar (main 0.30%). CARVE traced it: the samples are derived from the s's own turn now and land on the same frames as before; the ruled landing takes the s through 34.6 degrees where main's is at 53.1, and the carve band's anti-aliasing is weaker there. That is the shader at that angle, shown by his ruled motion, not a fault in the letter code. **Open: CARVE-AA**, make the carve band hold at 30 to 40 degrees of grazing, so f224 clears the 1.4% bar without changing the motion.

### 2026-09-29 · CLOUD-L2 · dispatched to a Claude Code cloud session
**What:** phase L2 of `docs/research-2026-09-26/layout-rethink/BUILD-PLAN.md`, move the transport state out of `components/viewport-3d.tsx` into a page-level store, so L3 can take the dock out of the viewport. L1 is built locally on `lane/dock1` (the canvas survives a drag, a maximize, a tab hide and 20 layout loads; open: one flaky load at 834x1112 and the must-fails rerun after the last gate edit), so the cloud starts from main plus L1.
**Where:** public repo branch `cloud/layout-l2`, snapshot commit `98071c9fcc593b20ef7537bf48ab36f1c2b80391` (main plus L1, no `docs/thinking`, no `docs/verification`, no transcript dumps; 173 MB, 1,716 files). `.githooks/pre-push` guards the public repo.
**Checks the cloud can run:** tsc at the baseline of 6, and the Node gates. No browser there: every browser gate runs here after `claude --teleport`, before anything lands, and he sees the panels first.
## FLIP-2 · 2026-09-26 · the flip on `/`: wiring traced, nothing built

NOT MERGE-READY. Nothing built. Branch `lane/flip2` in `~/.fs-lanes/flip2`, on main 6fe1665b8. The lane crossed its 100k context line at 23 tool calls while tracing the wiring, before the first edit. No dev server and no browser were started, so there is nothing to kill, and `.next/` was never created. No gate or regression was run, since no code changed.

What the next lane needs, so it does not trace this again:

- **The fold.** `components/viewport-3d.tsx:6560-6585`, the block headed "THE POSE, AND THE DEV OVERRIDE ON TOP OF IT". Today `base = flattenSrc.current`, then `keyReader.sample()` folds depth and turn (turn in degrees, yaw in radians), then `readFlatOverride()`. The flip goes between `base` and the keys, as `{ ...base, ink, depth, yaw, shade }` from `flipPoseAt(clockMs / 1000, opts)`. FlipPose also returns `sx`. Whether the lab feeds `sx` into FlatState's `squashX` (lab:2031-2062) was not checked.
- **The clock is the real blocker.** With no keys, `keyReader` is `undefined` (vp:11305, `hasAnyKey(keysIn) ? keysIn : undefined`), so a plain take has no clock for the flip to read. And `totalDuration = max(takeLen, keysEndMs(keys))` (vp:11310), so the transport stops when the pen stops, and a flip placed after the draw-in never plays, live or in export. The smallest fix I found: when the flip is on, build the reader with empty keys and `totalDuration = max(takeLen, keysEndMs, flipEndMs)`. `makeKeyReader` (vp:7831) then sets `remapsReveal`, because `lengthMs !== takeLen`, and `keyedRevealRef` (vp:7864) holds the draw-in at `takeLen` while the clock runs on. Export length follows, since `exportMs = totalDuration` (vp:11311). Not read: whether `revealClockMs` with empty keys clamps at `takeLen`. Flip Off leaves `keys` undefined, which is how Off stays byte-identical to main.
- **The store.** `StyleState` (`lib/style-system.ts:352`) gets `flip?: "off" | "flatToSolid" | "solidToFlat"`, validated on load in `lib/doc-store.ts`. The viewport already receives `styleState` (page:2586, vp:3949). `DrawInTimingControls` does not. It gets `flatten` and `patchFlatten` through page's `drawInTiming` object (page:2466-2478), typed as `ComponentProps<typeof DrawInTimingControls>` (scaffold:75), so new optional props pass through the scaffold untouched. Wiring them takes two lines in `app/page.tsx`, which is outside this lane's list: `flip: styleState.flip` and a `patchFlip` through `setStyleStateRecorded` (page:1167), the undo-recorded path. Get a yes before touching page.tsx. The viewport's own `<DrawInTimingControls>` at vp:14575 sits in PANEL-5's hunk, so it goes without the pills for now.
- **The pills.** Under Shading in "The form" card, dtc:390-450. Reuse the Shading pills' classes exactly (`fs-press rounded-full border px-2 py-0.5 text-[10px]`, pressed `border-foreground/20 bg-foreground text-background`). Off, Flat to solid, 3D first.
- **The lab's numbers, to read like the lab.** From `lib/hero-motion.ts` defaults: `beats.emerge = 0.85 + 2/30` s, which is `beatSec` (the whole turn, dwell included), `emerge.dwellSec = 2/30`, `flatDepth 0.004`, `turnShade 0.35`, `edgeFloor 0.035`. The lab's default shape is `"shipped"`, so `landYawOf` (hm:2258) gives 0: the lab lands head-on, not at the plan's three-quarter K3. `landYaw: 38` only applies to `turnLands` and `solidFirst`. Which landing `/` gets is his call.
- **Start.** After the draw-in lands, plus the plan's 10-frame K1 hold: `startSec = takeLen / 1000 + 10 / 30`. `flipEndMs` is start plus beat plus the 15-frame K3 hold.
- **Export row.** `assert-key-lanes` row 10 (lines 477-560) already records `__fsKeySample()` at every frame the real Video export grabs, by wrapping `drawImage` and `VideoFrame`. The flip gate can reuse it. `__fsKeySample().applied` reports only depth and yaw today, so ink has to be added before a row can see the face swap.
- **The lab half of the strip.** I found no clock-seek hook on the lab page: its `__captureHarness` type (lab:2184) declares only `orbitView`. The hero film frames live under `docs/verification/hero-beat-film/<label>/`, outside this sparse clone, and `_probe-film-sheet.mjs` cuts sheets from them at named playhead times. That is the likely source for the lab column.

### FLIP-3 · 2026-09-26 · the flip built on `/`, gate written, not yet run

NOT MERGE-READY. The code is built and committed, and tsc holds at 6, the baseline. The gate `scripts/verify/assert-flip-slash.mjs` is written, and its Off base is recorded. It has NOT run against the built code, because the lane crossed the 150k context gate first. No strip and no regressions ran. Nothing below is verified until the gate runs.

Built, in this commit:
- `components/viewport-3d.tsx`: `flipOptsFor` and `flipEndMs` sit beside `makeKeyReader`. Every number comes from `DEFAULT_HERO_MOTION`, with `landYaw` 0 (the lab's "shipped" shape), a start 10 frames after the pen lands, and a 15-frame hold after it lands. The reader carries `flip`. The fold adds `posed` between `base` and the keys, so Turn and Depth keys still win and the flip owns the ink. In the take-length block, with the flip on, the reader is built over `NO_KEYS` and the length is `max(takeLen, keysEnd, flipEnd)`. With the flip off, all three expressions are main's. `KEY_LIVE.pose`, plus `pose` and `flip` on `__fsKeySample()`, are there for the gate.
- `components/draw-in-timing-controls.tsx`: Flip pills under Shading (Off, Flat to solid, 3D first) in `role="group" aria-label="Flip"`, using the Shading pills' classes unchanged.
- `app/page.tsx`: the two lines, `flip` and `patchFlip`, through `setStyleStateRecorded`.
- `lib/style-system.ts`: `FlipChoice` and `flip?`. `lib/doc-store.ts` checks `flip` after the coerce and drops an unknown value with a repair.
- The gate has 7 rows, each with a must-fail. `docs/verification/flip-slash/off-base.json` was recorded at 0baf417ce and read twice. Both reads were identical, which is the positive control for row 1.

Next step: start a dev server on 3139, warm it, then run `FS_HEADED=0 FS_PORT=3139 node scripts/verify/assert-flip-slash.mjs --strip --lab-film=$HOME/Desktop/Projects/free-stroke/docs/verification/hero-beat-film/shipped/film-30.mp4`. After that, run the regressions in the FLIP-3 brief. Four guesses in the gate are unchecked:
- the Flip pills are reachable on the undocked page;
- Meta+z reaches undo while focus sits on a pill;
- the Video export draws from the GL canvas through `drawImage` or `VideoFrame`;
- `t` in the lab film equals the hero clock, so `phaseOffsets(hm).emerge` finds the lab's flip.

### FLIP-4 · 2026-09-26 · the flip gate run: 7 of 7 after two fixes, and the edge does not read on `/`

NOT MERGE-READY, for two reasons. One: on `/` the flip never goes visibly edge-on. The viewport's camera looks at the mark from an angle, so the moment the lab is built around does not happen on screen. That is his call, below. Two: 4 of the 38 stroke-timing rows did not run in this clone, so that gate is 34 of 38, not 38. The flip gate itself passes 7 of 7 with every must-fail firing, and Off is byte-identical to main, so a merge would not change the default page. Gate fix in 846675144.

The four guesses FLIP-3 left:
- **The pills on the undocked page: wrong.** They exist only inside the Animation drawer, opened by the "Edit Animation" button in the Style strip, and the drawer shrinks the canvas from 755x890 to 755x449. The first run timed out on the click. `choose()` now opens the drawer, clicks, shuts it, and refuses unless the canvas is back at its pre-open size. The toggle's title reads "Close Animation" while open, so the gate finds it by either title.
- **Meta+z with focus on a pill: right, and now checked.** Row 7 keeps the drawer open and requires focus on "Flat to solid" before the key goes down.
- **The Video export draws the GL canvas through drawImage or VideoFrame: right.** The hook saw 448 exported frames.
- **Film t equals the hero clock: wrong, by 6 frames.** The film's zero is read before the play click. Its edge-on frames sit at 6.700 and 6.733 s, where `phaseOffsets(hm).emerge` plus the law's edge (13/30 s) says 6.500 s. The strip now finds the lab's start in the film's own pixels, as the frame where the mark's width collapses (6 px of 198) minus the law's edge time, and refuses when there is no collapse. Lab start 6.2667 s.

Neither fix moves a bar. Rows, on 371fc6ea4 plus the gate fix, server :3139 clean:
1. Off: 9 playheads and the take equal base 0baf417ce. Must-fail (Flat to solid on the same grid) fired, 42 fields differ.
2. Flat to solid: 32 of 32 clocks exact, 2 on the edge-on hold. Must-fail (start 1 frame late) fired, 12 of 32 differ.
3. Length: 14866.0 ms = max(takeLen 13116.0, flip end 14866.0), 24 of 24 clocks past the pen show the whole draw-in. Must-fail (the pre-flip length) fired.
4. Turn key: yaw 0.523599 equals the key, the flip's own is 0.425551, ink 1 equals the flip. Must-fail fired.
5. Export: 448 frames, 448 equal flipPoseAt at their clock, the last at the flip's end, 44 inside it, 2 edge-on, 8 of 8 replayed live equal. Must-fail (one frame later) fired, 5 of 8 differ.
6. 3D first: 32 of 32 exact, ink 0 to 1. Must-fail (the Flat to solid law) fired, 30 of 32 differ.
7. Cmd-Z: focus on "Flat to solid", after Cmd-Z the flip is off and the Off pill is pressed. Must-fail fired.

What I saw in `docs/verification/flip-slash/strip-12.png`, `/` above the lab at the same flip-relative clocks:
- **Lab:** flat and head-on through f+8, squeezed at f+11, one vertical line at f+13 and f+14, squeezed at f+15, full width from f+17, head-on at f+28. The edge holds 2 frames, 67 ms, and the flat-to-solid swap hides inside it.
- **`/`:** the camera looks at the grid from an angle. The word turns: its baseline slants down to the right at f-3, flattens by f+8, slants up to the right at f+13 and f+14, and is back on the f-3 slant by f+28. The dwell is there, f+13 and f+14 are the same picture, 2 frames like the lab. But at the dwell the word is fully legible and about as wide as at f-3. It never collapses to a line, so there is no moment, and the ink swap at f+13 happens in plain view instead of behind the edge. At strip scale I could not tell flat ink from lit on `/`, so the solid's arrival is unchecked.
- **Landing:** at yaw 0, on the slant it started at. Head-on in the model, not on screen.
- **Cause:** not FLIP-3's code. Row 2 says the pose is the lab's law exactly. The lab turns the mark in front of a head-on camera and `/` turns it in front of the viewport's angled one. I changed no product code.

His call: should the flip on `/` turn the camera head-on for the beat, turn the mark about the screen's vertical axis so it goes edge-on from any camera, or play from whatever camera he has?

Regressions, summary lines only:
- `assert-flip-pose`: exit 0, "8 of 8 rows pass; 10 of 10 mutants caught; rows with no must-fail: none"
- `assert-key-lanes`: exit 0, "16/16 graded rows pass; 0 SELF, not graded; 16 of 16 rows"
- `assert-hand-clock`: exit 0, "MUST-FAIL: 10 of 10 fired"
- `assert-perform`: exit 0, "15 PASS  0 FAIL  0 SELF, not graded"
- `assert-take-timeline`: exit 0, "21 PASS · 0 FAIL · 0 VACUOUS"
- `assert-stroke-timing-browser` --grade-solid: exit 1, "34 PASS · 4 FAIL  (engines rod, inflate, extrude, solid)"
- tsc: 6 errors, baseline 6

The 4 stroke-timing FAILs are the 6a rows for rod, inflate, extrude and solid, each "NOT RUN": their `docs/verification/stroke-timing/base-*.json` is tracked in git but not checked out in this sparse clone. A skipped check is not a passed one. The next lane runs them where the bases exist.

Evidence the gates rewrote outside `flip-slash/` was restored after each run: docs/verification/keyframes/assert-key-lanes.json ; docs/verification/hand-clock/gate-summary.json ; docs/verification/perform/f121-dwell-engines.json docs/verification/perform/f121-dwell-extrude.png docs/verification/perform/f121-dwell-inflate.png docs/verification/perform/f121-dwell-solid.png ; docs/verification/stroke-timing/inflate-nose-speed2-noslope.png docs/verification/stroke-timing/inflate-nose-speed2.png . The 8 untracked hand-clock PNGs the gate left were removed. Server killed by exact pid after a cwd check, `.next/` deleted.

### FLIP-5 · 2026-09-26 · three cameras for the flip, filmed side by side

NOT MERGE-READY: WAITING ON HIS CAMERA CALL. The sheet is `docs/verification/flip-slash/options-sheet.png`. It has three rows: today's `/` on the desk camera, A head-on for the whole take, and B the `flip.settle` prototype. All three use the same 12 clocks, from 0.5 s before the flip to f+28, and every cell carries the word's ink width.

What I saw, row by row:
- **Today, desk camera.** The word sits on the desk slant, sloping down to the right, and does not move until f+4. It levels out at f+8 and f+11. At f+13 and f+14 it slopes up to the right, fully legible, 71% of its widest. It is level again at f+17 and back on the starting slant by f+24. It never gets thinner than 71%, so there is no moment, and the flat-to-solid swap at f+13 happens on a word you can read.
- **A, head-on for the whole take.** The word faces the viewer square on. Full width through f+4, 92% at f+8, squeezed to half at f+11, then a single vertical line 1 px wide at f+13 and f+14, 64% at f+17, full again by f+24. That is the lab's beat: the lab goes to 16 of 595 px on the same two frames. The swap hides inside the line. A needs no product code. It is what the flip already does when the camera is head-on; the film keys azimuth and elevation to 0 to get there.
- **B, `flip.settle`.** It starts on the desk slant like today. At f-10 the camera is mid-swing (azimuth 45 down to 33, word at 84%), at f-5 it is nearly square (98%), and from f+0 every frame matches A's width to the pixel, including the line at f+13 and f+14. So yes, B reads like the lab at the edge. From the desk angle the settle looks like a quick camera swing into the flip, and the grid behind the word shears while it turns. After the flip the camera stays head-on and is his again.

One difference from the lab, measured, cause not checked: the word comes out of the edge more slowly on `/`. At f+15 the lab is back to 47% of its width and `/` head-on is at 9%. At f+17 the lab is at 86% and `/` at 64%. Going in matches (f+11: lab 47%, `/` 53%). Row 2 says `/` follows the flip law exactly, so the gap sits either in the lab film or in how the law's exit lands on the 30 fps clock. I did not chase it.

What changed:
- `components/viewport-3d.tsx`: `FlipSettleCamera`, mounted only with the flip on and no camera keys, and it writes nothing unless `window.__fsFlip = { settle: true }`. It eases from the current camera to azimuth 0, elevation 0, same distance, over the 0.5 s before the flip on a smoothstep, holds through the flip, and stops writing once the flip has ended. Camera keys win because it is not mounted when a camera channel has keys. Off, row 1 is still byte-identical to base.
- `scripts/verify/assert-flip-slash.mjs --strip` films today, then B, then A, and reads every frame's camera back. It refuses when a film's camera is not the one it claims, when the desk camera is already head-on, or when the desk camera is not put back before rows 4 to 7. Measured: desk azimuth 45.00, elevation 35.26, distance 1.700. B at f-15 is 45.0/35.3, f-10 33.3/26.1, f-5 11.7/9.1, and 0.0/0.0 from f+0.
- The width instrument was blind twice before it worked. The first cut read the lab's 6 px edge-on frame at 100%. The second read the grid, 533 px on all 12 `/` frames, because the grabs are transparent and the paper came out black, the same colour as the ink. It now composites over white, counts only pixels 120 or more in luminance from the paper, and refuses unless the lab row is a line at f+13 and f+14 and full at f+0.
- Evidence in `docs/verification/flip-slash/`: `options-sheet.png`, `strip-A.png` and `strip-B.png` (each above the lab), `strip-12.png` (today above the lab, redrawn with widths), and `options.json` (widths, centres, and B's camera per frame).

Gate: 7 of 7, every must-fail fired, on 737465bee plus this change, server :3139.

Regressions, summary lines only:
- `assert-flip-pose`: exit 0, "8 of 8 rows pass; 10 of 10 mutants caught; rows with no must-fail: none"
- `assert-animation-panel`: exit 0, "8/8 rows pass, 9/9 must-fails fired, 30 popover controls checked". The first run refused with "no baseline" because `docs/verification/animation-panel/` sat outside the sparse set. I added it to the sparse checkout; the baseline is the branch's tracked file.
- `assert-key-lanes`: exit 0, "16/16 graded rows pass; 0 SELF, not graded; 16 of 16 rows"
- `assert-stroke-timing-browser --grade-solid`: exit 0, "38 PASS · 0 FAIL  (engines rod, inflate, extrude, solid)", with main's 3 `base-*.json` copied in. All 38 ran this time.
- tsc: 6 errors, baseline 6.

His call, with the sheet in front of him: today (the flip plays from his camera and the swap is visible), A (the flip only reads when he frames head-on himself, or the flip forces head-on for the whole take), or B (the camera swings head-on half a second before the flip). If B, two smaller calls: should the camera go back to where he had it after the flip, and is 0.5 s the right length for the swing?

Evidence the gates rewrote outside `flip-slash/` was restored after each run: docs/verification/keyframes/assert-key-lanes.json ; docs/verification/animation-panel/result-lane.json, plus 6 untracked `drawin-open-*.png` the panel gate left, removed ; docs/verification/stroke-timing/inflate-nose-speed2-noslope.png docs/verification/stroke-timing/inflate-nose-speed2.png. Server killed by exact pid after a cwd check, `.next/` deleted.

### FLIP-6 · 2026-09-26 · the flip settles the camera head-on, no flag

MERGE-READY. His call (rulings 2026-09-26, "His three calls", 3) is now simply how the flip works: choose Flat to solid or 3D first and the camera settles to the front over the 0.5 s before the flip, then the word flips like the lab. `window.__fsFlip` is gone.

How it works, in `components/viewport-3d.tsx` (`FlipSettleCamera`):
- The camera eases from his framing to the lab's view, same distance, on a smoothstep over the 0.5 s before the flip, and holds there through the flip. The lab's view is azimuth 0, elevation 0: `sampleHeroMotion` reads 0/0 on every frame of the lab's emerge, and the gate derives it from there instead of restating it.
- The camera is a function of the clock and his framing, so export equals live. Before the settle it is his framing, exactly: scrub back before it and his camera comes back from a snapshot of position, rotation, zoom and target. Flip Off puts it back the same way on unmount, which is why Off stays byte-identical.
- From the settle on, the flip owns the camera the way a keyed camera does: an orbit there is written over on the next frame. He frames the shot before the settle.
- Keys win by not mounting. `FlipSettleCamera` mounts only when the take has no azimuth, elevation, distance or Turn keys. A camera key hands the camera to `KeyCamera`. A Turn key replaces the flip's yaw, so there is no edge-on to face, and the camera stays his.

What I saw on the strip, `docs/verification/flip-slash/strip-12.png` (`/` above the lab's shipped film, 12 clocks from f-15 to f+28): at f-15 the word lies on the desk slant, sloping down to the right over a grid in perspective. At f-10 the slant is about half, and at f-5 the word is nearly level and the grid is square. From f+0 to f+4 it faces front at full width. f+8 is 93%, f+11 is squeezed to half, and f+13 and f+14 are one grey vertical line 1 px wide, where the lab shows a black bar 16 px wide. f+17 is back at 64% (the lab 86%), and f+24 and f+28 are full width. Two differences from the lab, both older than this change: the word comes out of the edge more slowly (FLIP-5 measured the same), and `/` draws thin light strokes where the lab film draws thick black ink, so its edge-on line is thinner.

Gate `assert-flip-slash`: 11 of 11, every must-fail fired, server :3139.
- 8 SETTLE: his framing 45.00/35.26 at f-20, 20.25/15.87 at f-7 (the law says 20.25/15.87), 0.00/0.00 at f+0, and 9 of 9 clocks from f+0 to f+28 within 0.5 degrees of the lab's 0/0. Must-fail: the same check on the f-20 camera, refused.
- 9 EDGE: ink width f+0 439 px, f+11 233, f+13 1 px (98 px of ink), f+14 1 px (98 px of ink). Must-fail: the 2 px check on f+11, refused at 233 px.
- 10 KEYS: with a Turn key the camera at f+0 is his, 45.00/35.26. With a camera key at 20/10 the camera reads 20.00/10.00 at f-7 and f+0. Must-fail: the key's cameras graded against the settle, refused.
- 1 OFF: identical to the base at 9 playheads plus the take. I re-recorded the base, because the old one came from 0baf417ce, which is not an ancestor of main. The new one comes from a temporary commit whose app, components, lib, hooks and styles equal main 97bced1ec (git diff empty), recorded twice, identical. Its frames equal the old base; only the head line changed. The temporary branch is deleted, so head 3d8ceb7bd in `off-base.json` no longer exists; the product code it names is main's.
- 11 REVERSE: 3D first is his framing at f-20 and 0.00/0.00 at f+0, f+13, f+14 and f+28. Row 6 still grades its reverse turn, 32 of 32.
- 5 EXPORT: 448 exported frames, 15 in the settle, 43 in the flip, all 43 on the lab's view; 8 of 8 exported clocks (4 in the settle, 4 in the flip) replayed live equal in pose and camera. Must-fail: live one frame later, 4 of 4 settle cameras differ.

Regressions, summary lines only:
- `assert-flip-slash`: exit 0, "PASS assert-flip-slash 11/11"
- `assert-flip-pose`: exit 0, "8 of 8 rows pass; 10 of 10 mutants caught; rows with no must-fail: none"
- `assert-key-lanes`: exit 0, "16/16 graded rows pass; 0 SELF, not graded; 16 of 16 rows"
- `assert-camera-moves`: exit 0, "10 of 10 rows pass; 17 of 17 mutants caught; rows with no must-fail: none"
- `assert-animation-panel`: exit 0, "8/8 rows pass, 9/9 must-fails fired, 30 popover controls checked"
- `assert-stroke-timing-browser --grade-solid`: exit 0, "38 PASS · 0 FAIL (engines rod, inflate, extrude, solid)", with main's 3 `base-*.json` copied in
- tsc: 6 errors, baseline 6

Rebase onto main 97bced1ec: RUN-QUEUE and LOG.md conflicted, both sides kept. No code conflicts. `lib/style-system.ts`, `lib/doc-store.ts` and the Shading block did not need a change. `strip-A.png`, `strip-B.png` and `options-sheet.png` stay as FLIP-5's decision sheet; `strip-12.png` is now the flip as it ships.

Open for him, not blocking: an orbit made after the settle point is written over until the playhead goes back before it. If he wants an orbit after the flip to stick, that is one more rule.

Evidence the gates rewrote outside `flip-slash/` was restored: `docs/verification/animation-panel/result-lane.json`, `docs/verification/keyframes/assert-key-lanes.json`, two `stroke-timing/inflate-nose-speed2*.png`, and 6 untracked `drawin-open-*.png` removed. Server killed by exact pid after a cwd check, `.next/` deleted.
**CLOUD-L2 started 2026-09-29:** session `session_01At4vMNeuSAgKf1wRvBgkzx` (https://claude.ai/code/session_01At4vMNeuSAgKf1wRvBgkzx), from a shallow clone of `cloud/layout-l2` at `~/.fs-lanes/cloud-l2`. Bring back with `claude --teleport session_01At4vMNeuSAgKf1wRvBgkzx`. Next for the cloud after L2: HAND-DRAW-P3 from `refs/lanes/hand2` (235ed4612, saved in main): the camera reads the hand clock's lifts (R11), Inflate holds, the export row, regressions.

### 2026-09-29 · CLOUD-HAND-P3 and CLOUD-CARVE-AA · dispatched to Claude Code cloud sessions
- **HAND-DRAW-P3:** session `session_01WZZLvuXDY8BD4vpUPypF9V` (https://claude.ai/code/session_01WZZLvuXDY8BD4vpUPypF9V), branch `cloud/hand-p3`, snapshot `refs/cloud/hand-p3-base` (main at 2a16950c7 plus phase 2's code files as base and lane copies under `docs/cloud-inbox/hand-p3/`). Merge phase 2 in with `git merge-file`, then R11 (camera reads the hand's lifts), Inflate holds (measure first), the export row.
- **CARVE-AA:** session `session_01GYamjDQKHe7s6QNjGHsNJj` (https://claude.ai/code/session_01GYamjDQKHe7s6QNjGHsNJj), branch `cloud/carve-aa`, snapshot `refs/cloud/carve-aa-base` (main at 2a16950c7). Make the carve band hold at 30 to 40 degrees of grazing so f224 clears the 1.4% bar; the letter motion does not change.
- Both come back with `claude --teleport <session>`; browser gates run here before anything lands.

### 2026-09-30 · three more cloud sessions, overnight
- **CLOUD-L3** `session_01QUvFEvidD8C3kguCUvePjw` (https://claude.ai/code/session_01QUvFEvidD8C3kguCUvePjw): waits for L2's LOG.md on `cloud/layout-l2`, then L3, L4, L5, L6, K2, K3 on `cloud/layout-l3`.
- **CLOUD-DRAWIN-EXTRAS** `session_01NSBBCh2xdNRJfsFb1Pr8C8` (https://claude.ai/code/session_01NSBBCh2xdNRJfsFb1Pr8C8): tip highlight, pressure-aware reveal, duration, the fifth reveal style, authored versus recorded (coverage items 10 and 11), on `cloud/drawin-extras`.
- **CLOUD-EXPORT-FORMATS** `session_01DSaLWZEt5nU2zJ2FJNekUk` (https://claude.ai/code/session_01DSaLWZEt5nU2zJ2FJNekUk): animated GIF, transparent video, animated GLB (coverage rows 92, 94, 96), on `cloud/export-formats`.
- Tried and failed: attaching to the L2 session to add a follow-up (`claude --cloud <id>` printed nothing in a pseudo-terminal); CLOUD-L3 chains after it instead.

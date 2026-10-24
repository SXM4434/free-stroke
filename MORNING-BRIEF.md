# MORNING BRIEF — free-stroke

> # ⏹ SUPERSEDED 2026-08-28. NOT DELETED.
>
> **Live: `docs/STATUS.md`, `docs/RUN-QUEUE.md`, `HANDOFF.json`.**
>
> **False here now:** *"No commits"* and *"Dev server on :3000"* (`:3`). Commits landed
> 2026-08-24; this repo serves on **`:3105`**. Its `tsc` 6 still holds.
>
> It says its full detail lives in `HANDOFF-2026-08-02.md`, which is superseded too.

**`tsc` 6, the baseline. No commits. Dev server on :3000. Seven films live.**
Full detail in `HANDOFF-2026-08-02.md`; this is the decision-ordered version.

---

## 1 · YOUR ERASER IS FIXED, AND THE CAUSE EXPLAINS WHY NOBODY CAUGHT IT

The white blank spots — *"like someone ran a eraser all over it"* — were a **three.js r175
texture-allocation bug**. `texStorage2D` allocates IMMUTABLE storage on a texture's first
upload; every later upload is a bare `texSubImage2D`. The pen field reused its `DataTexture`
across re-bakes on the strength of a comment that was true before r175 and false after it.
After a resize the GPU storage stayed **1192×324** while the field was **1152×294**, so the
shader scanned the wrong rectangle: **your mark was carved by a stretched, offset copy of its
own outline.** Interior chunks removed, exterior kept.

**Why every gate was green while you kept seeing it:** a plain load-and-play never resizes the
field. Moving the **wobble** slider does. Setting endpoint **CLEAN** does. Your state was
wobble 0 + endpoint clean — *both dials off default*. The whole battery loads and scrubs and
**never touches a dial**. The bug was only reachable by using the app.

Proof: `docs/verification/drawin-holes/SHEET-eraser-CLOSED-draw80-6x.png` — same build, same
frame, same field. Shredded crescents → solid "Doo" with open counters.

Also re-derived: the carve envelope 2.6 R → **1.60 R**. The 2.6 was itself an artefact of the
misregistration, and it had quietly turned `assert-flat-silhouette` **red on the tree**.

---

## 2 · YOUR OWN TEXT WORKS NOW — and the cause was worse than the theory

The five discs were **not** fused letters. **The font had seven drawable glyphs.** In "the
quick brown fox jumps", **20 of 25 characters drew nothing at all** and the pen advanced past
them in silence. Now **97 glyphs**, accent + smart-quote folding, and unsupported characters
are **named in the panel** instead of vanishing.

The scaling half got a derived threshold, not a guess: legibility is **nib ÷ cap height**,
ceiling **0.2176 — set by your own `e`**. The fix holds cap height instead of span, so that
ratio is invariant at any length and long text wraps. Your pangram goes **0 counters → 6**.
`"Desk Doodles"` is proven **bit-for-bit unchanged**.

---

## 3 · 🟡 THREE CALLS THAT ARE YOURS

1. **THE `e` — and I told you this wrong yesterday, corrected.** I said your `e` renders as a
   blob "in Desk Doodles itself". **It does not. Your handwriting's `e` is OPEN** — counter
   42 × 18 px, measured through the same pen. **The blob is the FONT `e`** (two counters
   26 × 6, against the `o`'s 39 × 39 beside it — 10× less counter area), and the page opens on
   `"traced"`, so it is not what a visitor sees on load. It decides "Any text" and the capture
   pipeline. Side by side: `docs/verification/e-options/SHEET-traced-vs-font.png`.
   **Six options rendered for your eye:** `docs/verification/e-options/v2/SHEET-e-options.png`
   — each on the real surface, flat and solid, head-on and ¾. The law is
   `eye = r + d − 2q`, so the bowl radius is the entire budget and dropping the bar is
   zero-sum. **Recommendation: C — widen the bowl 22 → 25**, one number, his own construction,
   and the only option that restores the *aperture* so the letter reads as an `e` in both
   solid views. Cost: two gate rows to re-baseline. "Leave it" is on the board as a real
   option and is defensible. **The shipped font is unchanged.**
2. **`envGain` 3.6 vs 4.4** on the 2D→3D arrival. 3.6 sits at the bottom of the measured
   45–63 reference band; 4.4 is mid-band. The lane chose 3.6 because at 16× the underside of
   4.4 loses the dark anchor that makes it graphite rather than milk. One number.
3. **Which of the seven films ships.** shipped · turn lands · solid first · cutaway · pop-up ·
   stand & turn · **letter by letter**.

---

## 4 · WHAT LANDED WHILE YOU SLEPT

- **O5 · letter by letter** — your favourite, built. Four channels per letter (yaw, flat,
  depth, shade), so each letter *converts* on its own beat rather than eleven solid letters
  spinning. The blocker everyone assumed (per-object materials, inverse arrays) **was not
  real**. Its letter map is measured from the ink: it reproduces the font's 11 exactly, and
  returns **8 on your traced word** — your hand fuses `e-s-k` and the `o-d`, so those flip as
  bound pairs.
- **Pop-up** and **stand & turn** — two more films, the second one mine, staging the stand and
  the turn in sequence because running them together made the word collapse to a sliver.
- **The 2D→3D switch now reads.** It was a **1.3 % event** — 3.0 luma of median on a mark
  whose ink-to-paper contrast is 229. Now **+25.8**. There is also **no fresnel rim** on this
  mark; turning it up improved the statistic and *ruined the picture*, so it ships as ported
  and the negative result is parked and re-runnable.

---

## 5 · ✅ THE DRAWING NOW MATCHES DESK DOODLES — the thing you asked for for days

**Free Stroke 5.578 · Desk Doodles 5.796 — 0.6 % apart.** It reads as the same long almond
at 8×; the wedge is gone.

How it was chosen, and this is why I trust it: the lane derived a **closed form** for the
gate's own statistic from the shader's own boundary — `span = nose·0.3068 + taper·0.5` —
and **validated it before using it**, six arms in one session, predicted vs measured
agreeing to **99–105 % across a six-fold range**. Then solved it for Desk Doodles' number.
Answer: taper **0.85 → 2.70**.

**It costs nothing.** Two uniforms. No rebuild, no per-frame geometry — so it does not touch
your lag complaint. The rebuild path (`filterStrokesByProgress`, 531 ms at the whole word)
was never needed.

**And the 2026-08-02 rejection of a long taper was wrong.** It was rejected then because the
tail "came apart into loose specks" — that was the **misregistered pen field**, not the
taper. Re-tested at the same device scale: taper 1.6 reads 19 specks against 0.85's 20.

The prior 0.85 is parked as **`chisel`** and I gave it a pill, so you can flip the two by eye.

🟡 One honest cost: on one capture the long taper opens **+1 worst-frame blank** and +2 specks
over 90 frames (worst-per-frame and component count identical). Routed to the gate audit with
instructions **not** to widen the bar to hide it.

---

## 5b · 🔴 THE CORRECTION THAT MADE THAT POSSIBLE — you were right, the gate was wrong

A prior handoff claimed *"Desk Doodles reads 2.142 — we now beat it."* **Backwards.** On the
repaired gate: Free Stroke **2.405**, Desk Doodles **6.835** — its end is ~2.8× rounder. You
have said its drawing animation is better for days and the instrument was telling us the
opposite, because its measuring disc was scooping ink from neighbouring strokes (median
27.7 % foreign, max 87.4 %) with noise 1.3–2.9× the effect. The old numbers
(2.400 / 1.233 / 2.142) are **unreproducible — stop quoting them.**

Re-measured on the fixed tree the gap held (2.38×, not 2.8×) — and is now closed, §5.

**I have corrected the panel copy on `/desk-doodles`.** It had been telling you *"Quill ships
and beats the Desk Doodles engine you called better (2.400 against 2.142)"* — I wrote that,
it was false, and it was on screen every time you opened the page. It now states the real
numbers and says plainly that you were right while the gate said otherwise.

---

## 5c · 🔴 THE GATES WERE LYING AT SCALE — 30+ OF THEM

The meta-gate read **`ALL 80 assert-* SCRIPTS ARE GATES`, exit 0**, every run. That was true
and it was never the question: it asked *is this a gate*, never *can this gate fail*.

**76 of 81 audited** (5 held by concurrent lanes, named). **33 repaired.** A sample of what
was green and could not have been red:
- `assert-preset-registry`'s reversibility row compared an object to a copy of itself —
  **always false**, so it restored nothing and was blind to in-place mutation too.
- `assert-drawin-2d-parity` row 1's two arms were the **identical pure call**.
- `assert-taper-envelope`'s row labelled "NEGATIVE CONTROL" was a fixed `true`.
- `assert-hero-dead-channels` **passed more strongly on the defect it named**.
- `assert-draft-taper` re-declared its own constant, letting the engine's roam 0.108–0.252.
- `verify-gates` tested **5 of 14** texture modes; `assert-motion-off` **4 of 8** behaviours.
- `_probe-nan-params` treated a thrown exception as neither pass nor fail — **all 16 cases
  could have thrown and it printed ALL PASS.**
- And **73 of 81 gates were in no sweep at all.** A gate nobody runs cannot fail in practice.

Five new channels now test whether a gate *can* fail — including one that runs every gate
**bare**, because the bare invocation is what the next person types. What they **cannot**
catch is stated rather than glossed: the noise class needs per-gate variance the row formats
do not expose.

## 5d · ✅ AND IT FOUND A CRASH — fixed, with the control filmed

`lib/geometry-engines.ts` sanitised its bevel-segment count with
`Math.max(1, Math.floor(segments))`. **`Math.max(1, NaN)` is `NaN`**, so the loop never ran,
the builder returned an empty profile, and the caller dereferenced it. `+Infinity` did not
crash — it looped until the heap died.

**Reachable from a dial you can move.** I drove it on the real GPU. With the guard removed:
`NaN` → `TypeError: Cannot read properties of undefined (reading '0')`; **`Infinity` → the
browser tab CRASHED after 9.2 s.** With the guard: all five values clean, `Infinity` returns
in 705 ms. Probe kept: `scripts/verify/_probe-bevel-nan.mjs`.

Two more real source defects it found are **not yet fixed** and are named in the handoff:
four zero-area triangles at the square loft's seam under `loopEnds: "wrapped"`, and a preset
blocker that reports a condition which no longer exists.

---

## 6 · THE LAG IS ROOT-CAUSED — and it is not the 3D

**React was re-rendering the whole page on every animation frame.** Of 12,960 ms across one
beat: **4,565 ms of React against 1,362 ms for three.js + R3F** — React cost **3.3× the actual
3D rendering.** The `Pill` component burned 70.8 ms during playback and **0 ms idle**, which
is the panel rebuilding itself every frame. Cause: `useDialTimeline` → `useSyncExternalStore`,
and `TimelineStore.tick` writes a new transport object every rAF.

Measured fix: net JS **4.88 → 2.88 ms/frame (−41 %)**, frames delivered in a fixed window
1458 → 1530 against a ceiling of 1545. Output proven unchanged — **192/192 frames
byte-identical, max channel delta 0**, with a calibration arm that reports 101/192 moved so
the equality test can fail.

✅ **INTEGRATED.** It rebased onto the current file rather than being hand-ported — and the
file moved again mid-flight (my Chisel pill), which it absorbed and re-verified. Final
numbers on the shared tree, same build, same clock:

| | before | after |
|---|---|---|
| net JS per rendered frame | 5.35 ms | **3.43 ms (−36 %)** |
| frames in a fixed 12.9 s window | 1415 | **1527** |
| fps while playing | 109.0 | **119.0** |
| `jsxDEV` | 1895 ms | 966 ms |

Output proven unchanged: **192/192 frames byte-identical, max channel delta 0**, with a
calibration arm reporting 104/192 moved so the equality test can fail. Its dependency list was
**re-derived from the TypeScript AST** against the new file and found **7 deps the old list did
not have** — exactly the state O5 and the custom-text lane had added. Its mutation control
(freezing those deps) turns 4 panel rows red, including the film-conditional dials.

It also **dropped the 134-file env-var shim** I turned down — 141 changed files → 4, all
genuine — and confirmed the tsc baseline is **6**, correcting its own earlier claim of 7 which
came from a stale snapshot.

**And it found two instruments lying:** `film-hero-beat.mjs`'s "worst paint gap" is a **CDP
screencast artifact, not a stall** (29 rAF callbacks ran at 9.3 ms mean inside the supposed
264 ms freeze), and its `REAL TIME 0.900x` is the parked tail — the true figure is 1.0019x.
Several lanes had been reading those as real.

---

## 7 · RUNNING NOW (4)

| lane | job |
|---|---|
| draw-in quality | close the 2.405 → 6.835 gap to Desk Doodles |
| gate audit | sweep all ~79 `assert-*` for gates that cannot fail |
| the `e` | render the options for your call |
| fusion | *"nothing actually applies"* + make it expansive |

---

## 8 · ⚠️ WHAT I OWE YOU HONESTLY

- **I built films while your #1 bug sat broken.** You were right to call it.
- **I merged a tree without running `assert-flat-silhouette`**, and it was red — the 2.6 R
  envelope had reduced the carve's silhouette contribution below the floor. A lane caught it,
  not me.
- One knob has **two names** (`HERO_URL`/`LAB_URL` and `FS_PORT`) after two lanes added an
  override independently. Both work, default unchanged. **It must collapse to one** — I turned
  down a patch that would have spread the second name across 134 more files.
- **`assert-hero-dials` passed a deliberately frozen panel** — 37/37 green while the controls
  genuinely did not update. Its green is not evidence the panel is live. Routed to the gate
  audit with the known-bad input already written.

---

## 9 · 🟡 ONE RED, AND IT IS A GATE DOING ITS JOB

`assert-timing` fails **PROVENANCE**: its stored captures are **141.9 h stale**, and it names
`lib/style-fusion.ts` (written minutes ago by the running fusion lane) as newer than the
evidence. Its own line: *"Every verdict below describes a build that no longer exists…
do NOT relax this check."*

That is the freshness channel added by last night's gate audit, working exactly as designed —
the same class that had `assert-hero-transition` silently grading a 4-day-old capture and
returning confident reds. **Not a regression, and deliberately not fixed yet:** re-capturing
while the fusion lane is mid-edit on those files would grade a half-finished surface. Re-run
`node scripts/verify/verify-timing.mjs` once fusion lands.

It also reports a real coverage gap: **`strokeTimeSynced` has no frames on disk** and no other
gate covers it.

## 10 · FUSION — diagnosed, lane running

Your *"i can make a new custom fusion but nhting actually apples"*. **It is not a broken wire —
the feature is authored so it cannot be seen.** Fusion MULTIPLIES already-resolved values
(`uFsTexIntensity.value *= …`), and `textureEnabled`, `ditherEnabled` and `asciiEnabled` are
**all `false` by default**. A brand-new custom fusion ships with links
`asciiField → ditherThreshold` and `breath → gloss` — so it drives a dither threshold on a
dither that is not rendering, from an ASCII field that is not rendering. Zero times anything.

Your second point is the bigger one and I agree: the space is ~**7 sources × 14 targets ×
3 drives** and the eight presets each touch only a couple of systems, so fusion *samples* the
space instead of spanning it. The lane is mapping the full space, naming and closing the gaps
(including whole systems that cannot participate at all), and building the real
**"fuse everything"** arm you assumed existed — with the guard that new presets must be
authored reads, not a permutation dump.

---

## 11 · ✅ FUSION WORKS, AND IT IS MUCH BIGGER — both halves of your complaint

### Why nothing applied — and my diagnosis was HALF WRONG

I told you the panel never switched the layers on. **It already did.** The real cause is
finer and I would not have found it by reading:

- Seed link `asciiField → ditherThreshold`: **worst field excursion 0.000000 — DEAD.** It
  reads the glyph field's **phase**, and enabling ASCII does not *animate* it, so the time
  uniform is pinned and `phaseTriangle(0)` returns exactly 0 **by design** — the quarter-period
  offset the file added as a previous defect fix.
- Seed link `breath → gloss`: touched only clearcoat/roughness/env — the four levers that file
  itself calls *"repeatedly measured near-invisible at stroke scale."*
- **12 of 16 fusion output fields were untouched.**

So a new fusion was born unable to act. The same shape as this repo's worst recurring bug —
a gate that cannot fail — one level up: **a feature that cannot fail to do nothing.**

The lane also caught **its own** error: its first contact sheet composited the transparent
canvas onto black and it read that as *"creating a fusion shreds the mark."* It does not.

### What a new fusion does now
Switches on Motion, ASCII (moving), Dither and Layer stack — derived from the fusion's **own
links** via source/target metadata, so a source added tomorrow is woken tomorrow. Additive;
never overwrites a layer you had on. Measured on pixels: both links live, **zero asleep**, the
mark's value travels **3.99×** further than at Link 0, and **94.1 % of the drawing survives**.

Legibility: a **live meter per relationship** (`now ▓▓░░ -0.27`, the signed push this frame),
a one-click **"Switch it on"** banner naming exactly what is missing, per-row fix buttons that
do only what they say, and **"Edit a copy"** on the built-ins — the best answer to *"it's not
clear how to set one up"* is a shipped relationship open in the editor as sentences.

### 🔴 AND IT FOUND A SHADER RECOMPILE ON YOUR LAG
`MeshPhysicalMaterial`'s `clearcoat`/`sheen`/`iridescence` setters bump `material.version` on a
**zero crossing** — they are `#define`s. A signed fusion link crosses zero twice per breath, so
the shipped `gloss` relationship was **recompiling the shader about every 2.5 s.** Latched now:
one crossing on selection, one on deselection.

### You were right about the coverage — 294 → 630
Six gaps found and closed, each a system that was running and could not be heard: the **layer
stack**, the **view** (nothing coupled the surface to turning the object), **one shared sine**
so every multi-link fusion throbbed as one body, **dither had no flow**, no layer exposed
**contrast**, and two live material levers were unreachable. `7 × 14 × 3` → **`10 × 21 × 3`**.

Still out and **named rather than shipped as dead entries**: geometry (fusion's contract is
uniforms-only; every geometry dial is a rebuild) and the reveal as a target (the playhead
belongs to the beat).

**"Fuse everything" exists** — *Whole Cloth*, nine links across every system, **every one on a
different driver**, because nine parameters on one breath is one throbbing object. Four new
relationships, each closing a gap rather than remixing what was already reachable. 12 × 3 with
no holes, all 36 reachable by click.

Sheets: `docs/verification/fusion-rail/v3/` and `docs/verification/fusion-newborn/`.

## 12 · TWO REDS RESOLVED, BOTH STALE ASSUMPTIONS NOT DEFECTS

- **`assert-hero-carve` 4/5** — the stored-capture trap again. Re-captured both arms:
  **5/5 SOUND**. Third time this gate has been read as red off captures that predate the build.
- **`assert-preset-routing` 32/33** — its CONTROL asserted *"undo is one-shot"*. That was true
  of the old one-shot revert and is **wrong about a better surface**: `revertPreset` is now an
  alias for the real undo stack, which every preset family records onto — the change that made
  ⌘Z reach the composition families that used to wipe your work. A general undo SHOULD succeed
  twice. Left alone it would have been "fixed" by putting the worse mechanism back. I
  re-pointed the control at what must still hold — **undo moves, and moves somewhere new** —
  and it still fails on a no-op undo, a self-repeating undo, or an empty stack.
  **ALL 33 PASS.**

---

## 13 · THE SWEEP — verified on the tree, not reported

| | before | after |
|---|---|---|
| model battery | **8 RED** | **2 RED** (34/36, 774 rows) |
| browser battery | 5 RED | **3 RED** (2 real) |
| `assert-gate-integrity` | **29 failures** | **2** |
| `verify-gates` · `tsc` | ALL PASS · 6 | ALL PASS · 6 |

### The three source defects — all fixed

1. **Four zero-area triangles at the square loft's seam.** Root cause was a comment describing
   the opposite of the code: the ball-chain prune read `dist + r_i <= r_j && r_i < r_j` under
   *"Strict on radius so two identical balls do not both die."* **Guarding against BOTH dying
   was implemented as NEITHER dying**, leaving a zero-length segment that broke the block's own
   stated theorem. Fixed with an index tie-break, not an epsilon, so containment stays exact.
   4 → 0 degenerate, and **all 32 geometry-baseline frames byte-identical.**
2. **The stale turntable blocker.** Three things held it up at once — the flag, the blocker, and
   a **string filter in the scaffold undoing it from the other side**. `assert-view-presets`
   1 red → **ALL 16 PASS** (spin ON Δpx 72.57 vs OFF 0.00). The interlocked gates were
   re-pointed at what must still hold rather than relaxed. It also found the **video** blocker
   stale in its reason — the writer and the API both exist; the gap is one missing `else if`.
   **Left unwired on purpose: a one-click multi-second render that writes a file is your call.**
3. **Module-private taper constants exported** — the gate that was text-parsing the file as a
   workaround now imports them.

### The meta-gate had the disease it was built to find
`assert-gate-integrity` 29 → 2. Two of its own channels were **greps reading comments as code**:
one mutated five tip constants at a gate merely because the word "nose" appears in one of its
comments, then printed *"SURVIVED EVERY MUTANT of a constant it names"* **about a healthy
gate**. Both strip comments now, three real pins were added, and each was demonstrated killing
its mutant.

### One knob, one name — done
`HERO_URL`/`LAB_URL`/`FS_PORT` → **`FS_PORT` only**, resolved once in a shared module across
37 files. Default byte-identical, and a legacy name now **throws with the replacement command**
instead of being silently ignored.

### Also closed
`assert-citations` (two stale citations, and it had been emitting **zero PASS rows** on a clean
run) · `assert-hero-transition` — its bare run now **captures and judges** instead of refusing,
killing the staleness class rather than managing it · `assert-hero-carve` 6/6, with a new row
pinning the capture's carve peak against the live value (a lane had moved it 0.7→1.12 and the
gate had not noticed) · `assert-timing-frames` 27/27 — its capture had **died mid-run five days
ago**, cut off inside one group, never reaching two others · `assert-drawin-pentip` 47 rows,
0 failures on a dense re-capture, **Free Stroke 5.578** · **`dit_pulse` DOES stop** — the rest
window was the last 20 % of *frames* against a lifetime in *seconds*, opening three frames
early; now reads **Δ 0 over 12 frames**.

## 14 · 🟡 ONE MORE PICK, AND IT IS A REAL TRADE

`assert-pentip-specks` is **still red on purpose.** On fresh dense evidence the shipped 2.70
taper costs, against the parked `chisel`:

| tip | taper | span | detached pieces | blank px at the pen |
|---|---|---|---|---|
| `chisel` | 0.85 | 0.73 w | — | 6 |
| **`quill` (shipped)** | 2.70 | 1.66 w | **z 2.92** | **12, worst frame +6** |
| `t160` | 1.60 | 1.11 w | z 1.39 | **6 — clean on both** |

**There is a middle, and it is now REAL.** ⚠️ `t160` existed only as a capture arm — a shape in
a report that could not be clicked. I have added it as a named tip, **`reed`** (taper 1.60), with
its own pill: *"if Quill reads too wispy, this is the one to try."* The verification arm and the
thing you click are now the same value. Tip pills on `/desk-doodles`:
**Quill · Reed · Chisel · Nib · Cut · Off.**

That omission is this project's own recurring defect one more time — I told you there was a
middle option and you could not have tried it.

## 15 · KNOWN AND NOT CLOSED, attributed
- **`assert-mode-rims` — 4 red, pre-existing.** Rod's cap-to-wall roll and Solid's facet ladder
  at the square's drawn corners. Real geometry, a look call, not a repair.
- **`assert-shell-states` — 1 red, pre-existing.** The documented React-root wedge after a
  render-phase throw.
- **`assert-screen-layers` — 0 failures, exit 1 on two WARNs**: `scanlines` vs `woodgrain`
  (Δ 4.80) and `hardThreshold` vs `pixelSignal` (Δ 1.62) are each **one look under two names**.
  Re-authoring them is taste. (Three *other* warnings were the instrument — a bare-reveal
  control proved it fired the strobe signature with nothing on screen at all.)

---

## 16 · OVERNIGHT — WHAT I TOOK AS DECIDED, AND THE ONE I DID NOT

You said *"yk the answer for most these — already authored, and yes ofc wire video export and finish ur stuff."* Here is exactly how I read that.

### Taken as decided and DONE
**Pen tip default → `Reed` (taper 1.60).** `Quill` (2.70) buys parity with Desk Doodles —
5.578 against its 5.796 — and costs **12 blank px at the pen against Chisel's 6, worst frame
+6, detached pieces z 2.92.** Reed is two thirds of Quill's reach and measures **6 blank px,
z 1.39 — clean on both channels.** Blank spots are the thing you have been angriest about all
week, so the default is the one that costs you nothing there and the parity read is one pill
away. **Quill · Reed · Chisel · Nib · Cut · Off** all live on the panel.

### Taken as decided and RUNNING
- **Video export — wiring it.** The writer and the API already existed; the gap was one missing
  branch. It is being wired with the things a multi-second file-writing action needs: says what
  it will do, shows progress, cannot be started twice, reports where the file went and fails
  out loud.
- **The two duplicate presets — re-authoring.** `woodgrain` that looks like scanlines (Δ 4.80)
  and `pixelSignal` that is `hardThreshold` under another name (Δ 1.62). Instructed to author a
  genuinely different look, **not** to delete one and **not** to nudge a number until the Δ
  clears — that is gaming the instrument.

### 🟡 NOT TAKEN — the `e`, and this is deliberate
I nearly applied option C overnight and stopped. Two reasons, both honest:

1. **The lane itself flagged the taste half as yours** — C makes the `e`'s bowl **4 % larger
   than your `o`**, inverting today's relationship between two letters in your own hand. That
   is not a legibility fact, it is a letterform decision.
2. **Its coupled constant is ambiguous in the lane's own report.** `FONT_R_CEILING` was listed
   as `0.1758` for C — but that number comes from `breakRatio`, which the same lane says is
   **the wrong measure for this decision**, because on C the aperture *opens*, counters go
   2 → 1, and an improvement scores as a collapse. The eye-survival figure for C is `0.2486`.
   Applying a font change while guessing which of two numbers guards it is how this project has
   been burned all week.

So it stays a one-click pick with the sheet already rendered:
`docs/verification/e-options/v2/SHEET-e-options.png`. **It is the FONT `e` — your traced
handwriting's `e` is open (42 × 18) and the page loads on traced, so your wordmark is
unaffected either way.**

### Also overnight
- **Crash recovery** — a lane is on the last real app defect: after an error the card keeps your
  drawing but its retry button **cannot work** because the React root wedges. Either it recovers
  for real or the dead button goes; a control that cannot act does not ship.
- **Worktree hygiene swept** — 0 stale lane worktrees, `.claude` 588 KB, disk 497 GB free.
- ⚠️ **`assert-cap-fit` 2 red, deliberately untouched.** Its failures are **negative controls no
  longer reproducing a recorded defect exactly** — the seam fix improved the geometry beneath
  them (`square` 54/15/41 vs recorded 54/17/41). The baseline needs re-recording **after** the
  geometry lane lands, not during.

---

## 17 · THE CORNERS ARE FIXED — your original complaint is closed

*"the weird joints, it looks like some stupid machine wrote it"* — `assert-mode-rims` was
**4 red for days**, carried in two handoffs as *"a look call, not a repair."* It was not.
**Three of the four were real geometry defects. ALL PASS, 189 rows.**

`insetLoopAgainstMask` carried three compounding bugs: its blind radius was **one cell** where
the arithmetic needs 2.00 (measured across all 1329 contour vertices — one cell misread 117 of
them); a quarter-round had **two different sizes** in XY and Z, so a clamped vertex dropped
full height and the slope went 15.0° → **65.9°** — that is the 64-edge cluster the census kept
reporting; and the flip repair halved blindly instead of solving. Plus `detectJoints3D` gave
`square/rod` **3 beads for 4 corners** — an end-cap exclusion still firing on closed loops that
stopped getting end caps.

`openArc/solid` worst mixed angle **84.73° → 69.86°**, edges past 45° **120 → 3**.
**Vertex and triangle counts identical on all 32 shape×mode combinations** — the fix changed
the surface, not the topology. Crops: `docs/verification/gloss-rim/rimfix/` — the raking-light
frame is the verdict; the cream bevel band goes from collapsing at every starved vertex with a
saw-tooth highlight, to one continuous band.

The fourth row was the **instrument**: it was counting the bevel's own designed 30° step as a
defect — `circle/solid` has a mixed max of *exactly* 30.00 and zero edges past 45, and still
scored 27.4 % "over 30".

## 18 · THE RETRY BUTTON WAS NEVER DEAD — and the error card was lying to you

The handoff said the React root wedges after a crash so the retry button *cannot* work. **Wrong,
and I had relayed it.** The button works. **The gate was breaking the app it measured.**

The test law poisons a stroke with a getter that throws on every read. React catches the first
one — card up, drawing intact. Then React DOM's **development-only** Performance Track props-diff
reads the same getter a *second* time inside passive effects, where no boundary can reach, and
`flushPassiveEffects` never restores `executionContext` — so every later flush hits an invariant.
**Zero occurrences of that code in the production build.** One variable, two answers: with the
dev instrumentation off, the card clears, the viewport re-mounts, and the drawing is still there.

**And the card carried a false sentence:** *"Your drawing is not saved, so copy anything you need
first."* Measured — 57 points in, reload, 57 points out. It is gone. `assert-shell-states`
**32 rows, 0 fail**, including *"THE DRAWING SURVIVED the crash and the rebuild."*

## 19 · NEW GUARD — the outage that hid inside a smaller number

A stray backtick inside `TEXTURE_COMMON_GLSL`'s template literal took both routes to **HTTP 500
for hours**. `tsc` reported **2 errors** — and the baseline is **6**, so every habit read it as
*better*. It was catastrophic: a parse error halts the compiler before it reaches the six known
errors. A lane, a controller and a battery all looked at "2" and moved on.

`scripts/verify/assert-tsc-baseline.mjs` now asserts the count **equals** 6 in both directions,
that the six are in the same two files, and that both routes still serve. **Proven against the
real defect**: re-armed, it fails all three rows and exits 1. Added to `docs/README.md`.

## 20 · SIX REDS RIGHT NOW, ALL ONE CLASS, ALL EXPECTED

`assert-material-craft` · `assert-stack` · `assert-stack-anim` · `assert-timing` ·
`assert-screen-layers` · `assert-pentip-specks` — **every one is PROVENANCE**, i.e. stored
evidence older than a `lib/` file. The style lane is still live and writing to `lib/style-*.ts`.
**Deliberately not re-captured:** capturing during another lane's in-flight edit stamps "fresh"
on a half-finished change, which is the exact false green the check exists to stop. Re-capture
when that lane lands and they go green — they did twice already tonight.

---

## 21 · LETTER BY LETTER IS ACTUALLY PER LETTER NOW

Your words: *"they dont go letter by letter — some go multiple at a time … it flips so ugly and abrupt and feels like artifacting happens."* All four closed, and the cause was worse than anything on record.

### It was rendering SIX pieces, not the eight we thought
The letter law was right; **what it was run over was wrong.** The page fed it the
hand-feel-decorated strokes, and `endpoint: "protrude"` runs every stroke past its own end into
its neighbour:

| your `e` and `s` | nearest approach | shared ink |
|---|---|---|
| raw pen paths | 21.3 px | **0.0 px** |
| after hand-feel | **2.2 px** | **36.0 px** |

The decoration welded the letters and the law read the weld — so it flipped
`D · esk · D · o · odl · es`: **three at once, twice.** The model said 8, the screen ran 6, and
neither number described the other.

### A second bug the calibration structurally could not catch
The merge reach was **1.0 nib — the tangency distance**, where two nibs share a point of *zero
area*. It passed calibration because `"Desk Doodles"` has **zero pairs of different letters that
close**, so the test only ever exercised the merge half and never the split half. Run on the
repo's own other authored word, **21 letters came back as 10**. Reach is now 0.5 and both words
are EXACT across 0.2–0.7.

**Result: 10 pieces — `D · e · sk · D · o · o · d · l · e · s`** — one bound pair, the `s-k`
ligature, which is the content-double the board sanctions by name. **It does not tear:** the
boundary falls inside the weld, not through a stroke, proven on both sides in
`o5-after/strips/junction-final.png`.

### "Abrupt" and "artifacting" were one budget problem
- The flip was **292 ms = 8.75 frames** — not a whole number — for 180°, worst single-frame step
  **50.9°** against the built turn's 29.8°. Now **12 frames, 33.0°**.
- The stagger was **0.46 s = 13.8 frames**, so each letter began 0.8 of a frame later in the grid
  and the 30 fps exposure caught **four different pictures of one event**. Now 14 whole frames,
  every quick flip drawn identically to 9 dp.
- The clip was wrong twice — it held **28 frames of dead air** before the payoff and was 29
  frames *short* of its own cascade. Re-cut 131 → 160.

### "Muddy" was two things and the lane claimed only one
The event half is the above. The **tone** half was a warm cast its own instrument was blind to
(luma moves 1.4 across the whole turn); measured as chroma it was the **material**, neutralised
by the concurrent brown lane — flat ink 7.80 → 0.00. It said so rather than claiming it, and
withdrew a wrong flag it had written against `applyLetterMotion` off a stale film.

### And it closed a gate that never existed
`assert-hero-letters.mjs` is cited by `hero-letters.ts:38` and `viewport-3d.tsx:2676,5347` —
**three call sites pointing at a file that was never written.** `assert-hero-options` now carries
the calibration: **39/39 rows, 18/18 controls** (from 34/34, 14/14), each new row with a
known-bad that fails it.

🟡 **One flag routed on:** at 7.36 s the `s` stipples white for one frame at grazing angle — the
carve fade in `components/viewport-3d.tsx`, another lane's file. Possibly the same mechanism as
the draw-in bite; that lane has it.

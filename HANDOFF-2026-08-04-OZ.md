# HANDOFF TO OZ — free-stroke — 2026-08-04

> # ⏹ SUPERSEDED 2026-08-28. NOT DELETED.
>
> **Live: `docs/STATUS.md`, `docs/RUN-QUEUE.md`, `HANDOFF.json`.**
>
> **False here now:** *"WEEKLY LIMIT HIT, resets Aug 7"* (`:3`) — three weeks stale.
> *"No commits"* (`:7`, `:199`) — closed 2026-08-24. *"dev server on :3000"* (`:199`) —
> it is `:3105`.
>
> **Still live, and it is why this file stays:** the three complaints in §0 and §1 are the
> same two asks tracked as **F1** and **F2** in `docs/RUN-QUEUE.md`. Four gates were run
> green against them on 2026-08-25. ⚠️ **A green gate is not his eye**, and he has not
> seen any of it at 1x.

🔴 **WEEKLY LIMIT HIT. Resets Aug 7, 1:00am America/New_York.** Sebs has been on the same
three complaints for hours and is out of patience. Read §0 and §1 before touching anything.

**THE TREE IS GREEN.** `assert-tsc-baseline` HOLDS — tsc exactly **6**, the same six in the
same two files, `/` and `/desk-doodles` both **HTTP 200**. **No commits.** Nothing is
half-broken, and the lane that died left a working tree.

---

## 0 · START HERE, IN THIS ORDER

1. `node scripts/verify/assert-tsc-baseline.mjs` — before anything. Baseline **6**.
   ⚠️ **A count BELOW 6 is a FAILURE, not a win.** A parse error halts tsc before it reaches
   the six known errors. A stray backtick inside a GLSL template literal took both routes to
   HTTP 500 **for hours** while tsc read "2" and three separate readers treated the smaller
   number as better. This gate exists because of that and checks both directions plus both
   routes. **Run it after every write.**
2. `node scripts/verify/run-battery.mjs` — 39 model gates, seconds.
3. `node scripts/verify/run-browser-battery.mjs` — 45 browser gates, slow.
   ⚠️ **Never run two batteries at once.** Six false reds in one session came from two
   batteries contending for one dev server; each one's own log said ALL PASS. Re-run any red
   **serially and alone** before believing it.
4. `MORNING-BRIEF.md` (590 lines) is the decision-ordered record of the last two days.
   `HANDOFF-2026-08-02.md` is the deeper one.

---

## 1 · THE LANE THAT DIED, AND EXACTLY WHERE

**Agent "Fix neighbours eating drawn letters" was killed by the limit mid-implementation.**
Its last words: *"Confirmed per-vertex. Implementing whole-triangle ownership with a boundary
vertex split."*

**It confirmed the diagnosis before it died.** `components/viewport-3d.tsx` :3215-3230 now
carries its full reasoning, and `scripts/verify/assert-letter-seam.mjs` **exists and reads 11
rows ALL PASS**. Read that comment block first — it is the design, written by the lane that
measured it:

> *Whole triangles give each letter a rigid shell and let the two shells separate at the seam…
> It is also the only one of the three that is EXACT, and therefore the only one a gate can
> state as a topology claim with no raster.*

> *A vertex carries ONE attribute value, so a vertex shared by triangles of two different
> owners has to become two vertices. Every attribute is copied, the index buffer is rewritten
> **IN PLACE** — triangle ORDER is untouched, which is load-bearing: `revealKeys` is a
> per-triangle array parallel to that order and `AnimatedStrokes` binary-searches it every
> frame.*

**⚠️ VERIFY BEFORE YOU CONTINUE:** `assert-letter-seam` passing may mean the split landed, or
may mean it is asserting a condition the current build satisfies trivially. **Drive the actual
picture** — `letterByLetter`, **ENGINE = FREE STROKE**, SOLID ~57 %, dead-on — and look. That
is the state Sebs photographed.

---

## 2 · HIS THREE OPEN COMPLAINTS, VERBATIM, IN HIS PRIORITY ORDER

### A · The draw-in still eats letters — **his #1 for over a week**
> *"the artifacting when drawing and letter pieces missing still happens"*

Three screenshots at DRAW 61 / 69 / 75 %, DESK DOODLES engine, wobble 0, endpoint clean: the
`o` has a bite out of its right edge at 61 %, reads as a **`u`** at 69 %, and is **whole again**
at 75 % once the `l` is drawn. **An already-finished letter is eaten by the letter arriving
beside it, and heals when that neighbour completes.**

**Ruled out, do not re-derive:** it is NOT the eraser bug (a three.js r175 `texStorage2D`
immutable-storage defect — GPU storage 1192×324 against a field 1152×294 — **fixed**, and that
one produced *white holes in a finished static mark*). Different symptom, different phase.

**The live hypothesis:** the DD path rebuilds from arc-length-clipped strokes and the implicit
surface **fuses** nearby strokes, so a partially-drawn neighbour is a different field from both
an absent one and a finished one. It may be the same root cause as B — see §3.

### B · Letter-by-letter tears the mesh into slabs
> *"look how the [mesh] gets fucked on letter by letter"*

Screenshot: `letterByLetter`, **FREE STROKE engine**, SOLID 57 %. Hard-edged **flat grey
slabs** protrude from seven letters. The mark is **one fused surface**; `applyLetterMotion`
rotates by a **per-vertex** `aFsLetter`, so triangles bridging two letters stretch into flat
sheets. The dying lane confirmed this and was fixing it.

⚠️ A sibling lane reported *"the split does not tear"* with a render. **That was the traced word
on the DD engine, where the boundary falls inside a ligature. It does not generalise.**

### C · Fusion — two dead, and coverage is far short
> *"slow weather and turntable dont animate"*
> *"there should be a fusion for every possible combo… there's like 7 styles… combos of 2 3 4 5
> 6 7… so it would be like 2 to the power of 7… for 2 there should be one fusion for every
> possible combo of two, etc"*

**The seven systems are the panel's own tabs:** `material · animation · texture · dither ·
ascii · layers · fusion` (`components/style-panel-scaffold.tsx` :153-204).
**He wants the full power set: subsets of size ≥2 = 2⁷ − 1 − 7 = 120 combinations, one fusion
each.** A previous brief asked only for the 8 subsets of {texture, dither, ascii} and got a
partial answer — **that was my scoping error, do not repeat it.**

⚠️ **The guard still applies but it is now secondary:** he has asked for exhaustive coverage, so
completeness is the requirement — but each preset must still be a real authored read. If a
combination is genuinely incoherent, **answer it with the render that proves it** rather than
shipping a filler cell.

**On the two dead ones:** `fusionWakePatch` was wired to the custom-fusion path only and has
since been carried to the model. `slowWeather` was already flagged by its own author as *"the
quietest cell on the liveness gate (0.97 on Burst)"* and `viewTurn` **only moves while the
camera does** — so check whether these are dead or merely inert in the state he viewed them in,
and if it is the latter, **that is still a defect**: a relationship that looks dead is dead.

---

## 3 · THE ONE THING I WOULD CHECK FIRST

**A, B and a third symptom may be ONE bug.** There is also a one-frame **white stipple** on the
`s` at 7.36 s of the cascade, localised to the carve fade `smoothstep(0.28, 0.42, |cos yaw|)`
in `components/viewport-3d.tsx`.

All three are **a boundary being treated per-vertex when it needs treating per-face**:
- the draw-in bite — a partially-drawn neighbour changing a shared field;
- the slabs — triangles spanning two letter transforms;
- the stipple — coverage landing in `alphaToCoverage`'s ambiguous band.

**Establish whether one root cause explains all three before treating them as three.** That is
the strongest available return and it is what the dying lane was heading toward.

---

## 4 · SEBS'S PICKS — his alone, all one click, all parked

| pick | options | recommendation |
|---|---|---|
| **the `e`** | 6 rendered options | **C — widen the bowl 22→25.** ⚠️ I declined to apply this unsupervised: the lane flagged the taste half as his (it makes the `e`'s bowl 4 % larger than his `o`), **and its guarding constant is ambiguous in the lane's own report** — `FONT_R_CEILING` listed as 0.1758 from a measure the same lane calls wrong for this decision, against an eye-survival figure of 0.2486. Sheet: `docs/verification/e-options/v2/SHEET-e-options.png`. **It is the FONT `e`; his traced handwriting's `e` is open (42×18) and the page loads on traced.** |
| **pen tip** | Quill 2.70 · **Reed 1.60 (shipped)** · Chisel 0.85 · Nib · Cut · Off | I set **Reed**: Quill reaches Desk Doodles (5.578 vs 5.796) but costs 12 blank px at the pen against Chisel's 6; Reed is ⅔ the reach at **zero** cost on that channel. |
| **3D ink** | **`#272727` (shipped, neutral)** vs `#282623` (warm, token-disciplined) | Neutral. Only it reads as graphite. |
| **`envGain`** | **3.6 (shipped)** vs 4.4 | 3.6 — bottom of the measured 45-63 band; 4.4's underside loses the dark anchor. |
| **which film ships** | 7 films | **His alone. Do not decide it.** |

---

## 5 · TRAPS THAT COST HOURS — do not rediscover these

- **`tsc` below baseline is a failure.** §0.1. Cost ~4 hours of both routes at HTTP 500.
- **Backticks inside a template literal.** `` `fsTexPeriod` `` in a GLSL comment inside
  `TEXTURE_COMMON_GLSL` terminated the string. This has broken this app repeatedly.
- **ALWAYS pass `--label=`.** Unlabelled, `assert-hero-transition` silently judged a
  **4.2-day-old** capture and returned three confident reds. It now captures on a bare run.
- **Gates that compare STORED captures need BOTH arms re-captured** before judging —
  `assert-hero-carve` was read as red three separate times off stale arms.
- **Editing anything under `lib/` stales every provenance-gated capture.** Re-capture:
  `verify-material-craft`, `verify-stack`, `verify-stack-anim`, `verify-timing`,
  `verify-screen-layers --label=final`, `_probe-pentip-shape --label=ship-dsf1 --dsf=1`.
- **Never run two batteries at once.** §0.3.
- **`--use-angle=metal` is load-bearing.** Without it Chrome falls back to SwiftShader, which
  **silently pauses the rAF loop** — a frozen animation and a still one are identical in a
  screenshot, so every timing number taken that way is worthless.
- **Captures ≥1440×1440**, or the timeline dock squeezes the stage and clips the mark.
- **A contact sheet can lie.** One was written as RGBA with 95.8 % of pixels at alpha 0 and
  composited onto white; another was read on black and misreported as the mark being shredded.
  **Assert your crops are opaque and composite on the real paper.**
- **`applyLetterMotion` MUST stay LAST on the onBeforeCompile chain.** Its whole mechanism is
  that its `<project_vertex>` replace lands after the joint break assigns `vFsBreakWorld`.
- **Worktree lanes:** Turbopack refuses a `node_modules` symlink pointing outside the worktree
  root. Use an APFS clone (`cp -Rc`), materialise `public/` as a real directory, and **assert
  the surface actually BUILT before grading anything on it.**

---

## 6 · THE DISCIPLINE THAT ACTUALLY FOUND THINGS

Every real bug this session was found by **looking**, and several were hidden by instruments
that could not fail. `assert-gate-integrity` went from **29 failures to 2** after a sweep that
found **33 broken gates**, including a reversibility check comparing an object to a copy of
itself, a row labelled "NEGATIVE CONTROL" that was a fixed `true`, one gate that **passed more
strongly on the defect it named**, and **73 of 81 gates in no sweep at all**.

**So: fix the check when the check is wrong; fix the surface when the surface is wrong; never
edit a surface to make a check pass; never relax a bar to go green.** When an intentional
improvement invalidates a gate's assumption, re-point the gate at what must still hold and say
precisely why the old assertion was wrong.

Sebs's own bar, verbatim: *"idk why it didnt just fix the issues it said thrre no point of
shoing me naything til u feel everthing is fixed."* **Close it, do not file it.**

---

## 7 · WHEN IT IS ALL GREEN

Sebs: *"hit lil fable to make it perfect when we done."* **Fable is approved for the final
polish pass** — the hand-feel and visual judgment only: does the flip read as a hand turning a
letter, does the graphite read as graphite, does the draw-in feel drawn. **Not** the field
math, the wiring or the gates — those are Opus work and are where every real bug this session
actually was. ⚠️ **Check his Fable budget before firing** — my note says it was near-empty
days ago; he approved it anyway, but confirm.

---

## 8 · STATE AT HANDOFF

`tsc` **6** · `/` and `/desk-doodles` **200** · **no commits** · dev server on :3000 with
`TURBOPACK_PERSISTENT_CACHE=0` · 0 stale worktrees, disk 497 GB free.

Landed and verified in the last two days: the eraser bug (a three.js texture-allocation
defect), the 2D→3D tonal arrival (+3.0 → +26.0 luma), the drawing's end matched to Desk Doodles
(5.578 vs 5.796), seven films including letter-by-letter, the corner joints
(`assert-mode-rims` 4 red → **189 rows ALL PASS**), crash recovery (the retry button was never
dead — the gate was breaking the app it measured), fusion's newborn no-op, the video-export
route, the letter map (**6 pieces → 10**, two independent bugs), and the brown (**Δr−b 23.92 →
3.84** — it was the ink, not the rig, dragged into view by the exposure fix for a different
complaint).

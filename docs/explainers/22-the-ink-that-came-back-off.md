# 22 — The ink that came back off, and the letter that was never the cause

Sebs, 2026-08-04, with three stepped screenshots of `/desk-doodles` on the **Desk
Doodles** engine, wobble 0, endpoint clean:

> *"there like artifacts that appear ahead of where the stroke is animating, and
> if a letter covers another like the d over the o it leaves part of the o just
> like erased — the o should still be fully drawn but its edge doesnt get drawn
> on that side."*

He is right that ink disappears. He is wrong about which letter causes it, and
the difference is the whole fix: nothing on that engine fuses, so the `d` cannot
reach into the `o`. What reaches into the `o` is the `o`'s own builder.

---

## 1. Reproduced first, at nine times

`scripts/verify/_probe-drawin-vanish.mjs` reproduces his four channels off the
live DOM rather than assuming them — engine **Desk Doodles**, wobble **0**,
endpoint **CLEAN** — and steps the draw phase one percent at a time, masking
every frame.

The number that matters is not the total. It is that ink already standing on the
page comes back off:

| | before | after |
|---|---|---|
| steps that take ink off the standing mark | **47 of 50** | **0 of 50** |
| pixels taken off in total | **1 522** | **0** |
| ink at DRAW 90 % | 22 524 px | 22 566 px |

The last row is the control: the finished mark is the same mark, to 0.19 %. This
was never about the mark. It was about what happens to it *while the pen is
still moving*.

`docs/verification/drawin-vanish/SHEET-lost-ink-12x.png` is the mechanism at
twelve times, and it is the picture that names the cause. Black is ink that
survives into the next one-percent step; **red is ink the next step takes off**.
Before, every step has a red band along the *outer edge of the earliest-drawn
part of the stroke*. After, there is no red on any step.

---

## 2. The cause: a profile parametrised on the length of what it is handed

The Desk Doodles engine reveals by **rebuilding from an arc-length-clipped copy
of the strokes** (`filterStrokesByProgress`), because
`lib/dd-engine/adapter.ts` never set `revealKeys` and the viewport's
`inflateRevealsByDrawRange` flag correctly noticed that and fell back.

And `lib/dd-engine/strokeTo3d.ts` `buildInflateGeometry` computes its radius from
**normalised position along the polyline it receives**:

```ts
const u = i / segments
const profile = Math.pow(Math.sin(Math.PI * u), profileExp)   // exp 0.8
let r = tipRadius + (baseRadius - tipRadius) * profile
```

Four of its inputs move when the clip grows, not just that one:

| input | where | what a growing clip does to it |
|---|---|---|
| `u = i / segments` | :1148 | a fixed physical point slides toward `u = 0`, i.e. toward the tip taper |
| `baseRadius` | :1100 | `min(dial, arcLen × 0.35)` — a short prefix is clamped thin |
| `segments` | :1105 | `clamp(pts.length × 4, 32, 256)` — the ring count itself changes |
| `synthPressures` | :1087 | curvature of whatever polyline it is given |

So the finished shape is correct and every intermediate shape is a *different*
shape. Measured on the second `o` of "Doodles", one fixed physical point at 25 %
of that stroke's own length, as the pen goes round it:

```
own progress   15.6 %   31.3 %   46.9 %   62.6 %   78.3 %   97.1 %   100 %
half-width      n/a     0.0201   0.0289   0.0253   0.0247   0.0216   0.0220
```

**Up 44 % and back down, on ink that had already been laid.** That is the "erased
edge", and it heals for exactly the reason he saw: when the stroke finishes, its
clip stops moving.

His causal story — the `d` over the `o` — is the one thing the mechanism rules
out. `buildOneStroke` builds each stroke into its own mesh; there is no shared
field on this path. What he saw was the *second* `o` mid-draw, reading as a `u`
at DRAW 69 % and whole at 75 %, and the letter drawn beside it was a coincidence
of timing. The complaint was real and the attribution was not, which is why the
fix had to be driven rather than assumed.

---

## 3. The fix is the one explainer 18 already proved

Explainer 18: *the reveal is a rendering problem*. Order the triangles by arc
length once, at build time, and animate with `setDrawRange`. A prefix of a buffer
that never changes cannot reshape what is behind it — monotonicity stops being a
property to test for and becomes one the mechanism cannot violate.

`components/viewport-3d.tsx` already routes on evidence rather than on an engine
name: `meshesCarryRevealKeys` is state the built meshes correct, and its own
comment says this engine *"builds a perfectly good Inflate mesh and never sets
`revealKeys`"*. So the whole switch was to set them.

**And the arc coordinate is read off the port rather than re-derived.** Both
builders Inflate can produce write the curve parameter into the uv V channel and
nowhere else — `buildInflateGeometry` sets `uvs[vi·2+1] = i / segments` with its
two poles pinned to 0 and 1 (:1192, :1207-1208), and `THREE.TubeGeometry`, the
rod fallback, sets the same thing. Both walk their centreline with `getPointAt`,
which is arc-length parametrised, so **uv.y IS the fraction of the stroke the pen
had covered**. `bakeRevealKeys` takes the max over each triangle's three vertices
(the FAR end — a triangle is drawn only once the pen has left all of it), maps it
into the stroke's global span, sorts the index buffer to match, and pins the
result non-decreasing. 22 meshes on the hero word, every one ascending, spanning
`0.0000 … 1.0000`.

Three things fall out of it, and only the first was the goal:

- the reveal is monotone **by construction**;
- the per-frame geometry rebuild is gone, so `SolidAnimationTick` no longer
  drives a React state update per frame on this engine;
- `revealFracNow` is no longer null, so the **pen-tip fragment test turns on for
  Desk Doodles** — the moving end gets the same nib the Free Stroke path has had
  since `lib/pen-reveal.ts` §T, instead of a per-triangle cut.

`docs/verification/drawin-vanish/SHEET-his-frames-9x.png` is his three frames,
before and after, at nine times. At DRAW 61 % the first `o` goes from a thin
crescent to a full-bodied `o` with its counter; at 69 % the second `o` stops
reading as a `u`; at 75 % both are whole and the `d`'s ascender is drawn.

---

## 4. The gate, and the known-bad it is calibrated against

`scripts/verify/assert-drawin-monotone.mjs` — **16 rows, model-only, no browser.**
A reveal is monotone by definition, and nothing about lights, materials or the
camera bears on that, so it asks the buffers: project each drawn triangle set to
XY, fill it, and require the mask at *t* to contain the mask at *t−1*.

It runs **both** mechanisms on **both** engines, and requires the second to fail:

```
desk-doodles · inflate    SHIPPED  0/40 steps lossy, worst   0.00 %   ·   PRIOR 36/40, worst  16.07 %
free-stroke · inflate     SHIPPED  0/40 steps lossy, worst   0.00 %   ·   PRIOR 12/40, worst   3.71 %
```

The known-bad is not a synthetic mutant. It is `filterStrokesByProgress` — the
code that shipped, still in the tree, still driving Solid, Extrude and the
Inflate loft — executed against the same rasteriser on every run. §2.6: *a gate
whose negative control passes is measuring nothing.*

Four more channels exist so the monotone row cannot pass vacuously: the table has
to be **ascending**, it has to **span the word**, the reveal has to **travel**
(0 % → 0 cells, 50 % → 52 478, 100 % → 107 860 — the "the word just auto appears"
defect, from the other side), and the finished reveal has to **be** the static
mark at zero cells missing.

**Calibrated against this morning's tree and required to fail there first.** With
the key bake neutered inside `_ts-load`'s mutation hook — nothing on disk touched,
which is what makes it safe under concurrency — the gate goes red on two rows and
exits 1, naming the mechanism the viewport falls back to:

```
FAIL  desk-doodles · inflate — every mesh carries a reveal table … 22 mesh(es), 0 with keys
                               → the viewport falls back to REBUILD-FROM-CLIPPED
FAIL  desk-doodles · inflate — SHIPPED (rebuild-from-clipped): ink already drawn NEVER comes back off
                               — 36 of 40 steps lose ink, worst 16.07 % … at 2.5 % → 5.0 %
```

One detail is worth keeping. **Worst is tracked as a fraction of the standing
ink, not as a cell count.** The raw count peaks late, because there is simply
more mark on the page to take ink off — 1 061 cells at 90 → 92.5 %, which is
1.09 %. The worst *fraction* is 386 cells at 2.5 → 5.0 %, which is **16.07 %** of
everything drawn. Reporting the count alone would have made the defect look ten
times smaller than it is.

`filterStrokesByProgress` moved from `components/viewport-3d.tsx` into
`lib/pen-reveal.ts` to make that gate possible — the file already *named* it as
one of the four reveal mechanisms and then did not contain it, so the only thing
that could measure it was a browser. The alternative was a hand copy, which is
the restated-constant class this repo keeps finding drifted.

---

## 5. The other half: 255 ms of React per gesture, on a number nothing rendered

Explainer 20 §10 handed this on by name: after the field build left the main
thread, the residual was *"Viewport3D's own React commit per pose."*

`scripts/verify/_probe-viewport-commit.mjs` profiles **the gesture he actually
makes** — load, press PLAY, watch the whole 12.37 s beat, scrub the transport,
switch the pills — at `deviceScaleFactor 2` through the real page. That
qualification is load-bearing: a previous lane measured a load-and-idle,
declared the surface clean, and it was janky in the hand.

The top of the profile was not geometry and not three.js. It was React building
elements — `jsxDEV` 659.0 ms, `jsxDEVImpl` 414.6, `createElement` 147.2 — against
`WebGLRenderer.render` at 66.5.

**The cause is one object.** `flatten` is a fresh `FlatState` on every pose (the
page's `useMemo` over `sample.*`), so its identity changed ~120 times a second,
so `AnimatedStrokes` and every R3F element under it — 22 meshes on the hero word,
253 on a Free Stroke Rod build — were re-created every frame. And nothing
rendered there reads the value: `flatten` is consumed in exactly one place, the
frame loop.

So it comes in through a **ref whose identity never moves**, and the component is
`memo`-wrapped. Measured as OFAT on the same take, the memo the only difference:

| inclusive, one 18.7 s gesture | memo off | memo on |
|---|---|---|
| **`AnimatedStrokes` subtree** | **255.1 ms** | **1.2 ms** |
| `jsxDEV` + `jsxDEVImpl` + `createElement` (self) | 1 220.8 ms | 1 004.3 |
| R3F `diffProps` / `commitUpdate` (self) | 44.0 / 38.9 | below the top-30 |
| React render+commit (self) | 93.7 ms | 76.4 |
| idle | 11 065 ms | 12 695 |
| rAF intervals over 16.8 ms | 7 of 2 205 | 5 of 2 208 |

**A 99.5 % cut on the mesh subtree's per-pose React work.**

The dev override had to move with it. It used to be folded once per *render*, and
a component that no longer renders per pose would have frozen an override on top
of a stale pose; it is folded per *frame* now, at the one site that reads the
state. `readFlatOverride()` returns null in production, so the shipped path is a
null check and no allocation.

### What is left, and where — because it is not the viewport any more

Inclusive time under each component on the same gesture, after:

```
   402.9 ms  DeskDoodlesHeroPage
   245.5 ms  Viewport3D
   119.8 ms  Scene
     1.2 ms  AnimatedStrokesInner
```

The biggest React consumer on the beat is now **the page's own chrome** — the
transport's seconds readout and the panel re-render on every pose, and
`setValueForStyles` / `updateProperties` / `setProp` / `validateProperty` are
plain DOM attribute writes, not canvas work. That is a hand-off with a number
attached, the same way §10 of explainer 20 handed this one on, and it belongs to
whoever owns `app/desk-doodles/page.tsx`.

Two caveats stated rather than buried: a large part of the absolute figures above
is **development-build overhead** (`jsxDEV` and `clearMeasures` do not exist in a
production build), and the frame health was already inside budget before the
change — p50 8.30 ms, 5–7 frames over 16.8 ms out of ~2 205. The win is real and
it is headroom, not a rescue.

---

---

## 7. The `s` that stipples white — handed over, chased, and NOT closed by me

The letter-by-letter lane reported that at **7.36 s** of the `letterByLetter`
film the `s` of "Desk" stipples white for one frame at grazing angle, and asked
whether the draw-in mechanism above explains it too. **It does not, and the
difference is measurable rather than argued:** the draw-in defect is geometry
being rebuilt (vertex positions moving); this one is fragment COVERAGE at
grazing incidence, on a surface whose vertices never move.

What is on disk is real. `docs/verification/hero-beat-film/o5-after/frames/0740.png`
at 14× carries an unmistakable **diagonal cross-hatch of white pixels through
the letter's body** — the signature of `alphaToCoverage` turning a fractional
alpha into a sample mask.

**The mechanism, named.** The carve's coverage ramp was

```
fsPpx    = max(length(dFdx(fsPq)), length(dFdy(fsPq)))
fsPenCov = clamp(0.5 - fsSd / fsPpx, 0, 1)
```

`fsPpx` is *the screen size of one local unit* — how far the FIELD's parameter
travels across one pixel. At 67.6° of yaw the visible surface is the tube's side
wall, nearly edge-on, so one pixel spans an enormous distance along the
foreshortened axis and `max` picks exactly that axis. The ramp is then metres
wide in field terms, the whole visible letter lands inside it, and every fragment
gets a fractional alpha. The O5 lane's `smoothstep(0.28, 0.42, |cos yaw|)` fade
reduces the carve AMOUNT, and the amount was never the cause — which is why it
was not widened.

**And the repo had already solved it, one block over, and not carried it across.**
`PEN_TIP_AA_FWIDTH` is the identical correction with the identical reasoning —
*"`fwidth(sd)` is the gradient the fragment actually has, so it is one pixel for
every shape at once"* — shipped, measured, prior parked on a dial. The carve was
left on the old divisor. `PEN_CARVE_AA_FWIDTH` is that fix ported, with
`__captureHarness.setCarveAA(false)` parking the prior for the same reason.

**What it is worth, measured, and what it is not.** OFAT on ONE build, both
divisors, `letterByLetter`, 7.0–7.8 s: white speckle inside the `s` totals
**8 862 px on the prior against 8 744 on `fwidth`** — 1.3 %, in the right
direction on essentially every frame, and 44 % on the single worst frame. At
dsf 1 across 7.28–7.46 s the two divisors disagree on 1 380–1 929 px per frame
and `fwidth` is never worse.

**But it is not what closes the reported frame, and the reported frame no longer
reproduces.** Re-shot on this build under BOTH divisors
(`hero-beat-film/graze-prior` and `graze-after`), the cross-hatch is **gone in
both** — what remains is a grey antialiased band on the letter's leading edge and
two or three isolated specks. Something between `o5-after` and now closed it, and
this pass cannot attribute that to itself. Stated plainly rather than claimed:
**the divisor is a correct antialiasing fix with its own evidence; it is not the
fix for that frame, and that frame is currently clean.**

## 6. Gates

- `assert-drawin-monotone.mjs` — **new**, 16 rows, ALL PASS; known-bad rejected on
  both engines; red on the pre-fix tree.
- `assert-tsc-baseline.mjs` — **6**, the same six in the same two files, both
  routes HTTP 200.
- `assert-citations.mjs` — one stale line fixed (`lib/geometry-engines.ts:1581`
  cited three consumer sites in `components/viewport-3d.tsx` that this pass moved).
- Re-captured, because editing anything under `lib/` stales every
  provenance-gated capture: `verify-material-craft`, `verify-stack`,
  `verify-stack-anim`, `verify-timing`, `verify-screen-layers --label=final`,
  `_probe-pentip-shape --label=ship-dsf1 --dsf=1`.

### Not caused here, and it cost the last hour

A **second lane was live in this checkout** while this pass ran — `pid 63987`,
`node scripts/verify/run-browser-battery.mjs`, plus three shell watchers — and it
was editing `lib/style-system.ts`. Verified by content hash, not by mtime: every
watched file was byte-identical across one 410 s capture except that one, which
changed underneath it. `_run-clean.mjs` caught each contaminated run and they
were discarded and repeated rather than adjusted, which is its whole purpose.
Provenance-gated captures cannot be made fresh while another lane is saving into
`lib/`, so they were re-taken through `_run-when-quiet.sh` in a measured quiet
window. DISPATCH §4 says file ownership is declared per dispatch and never
assumed; this dispatch was told the tree was empty and it was not.

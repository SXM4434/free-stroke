# The Desk Doodles engine, ported — and what it actually looks like

Free Stroke now carries two complete stroke→geometry engines. This explains what
came across, how the switch works, and — the part that matters — which one reads
better in each mode, judged on frames rather than asserted.

The instruction was explicit: *"we have the code and the engine, so just port it
over. DO NOT RECREATE WHEN WE HAVE THE CODE."* So this is a file port. Fourteen
Desk Doodles files sit in `lib/dd-engine/`, nine of them byte-identical to their
source, all fourteen carrying their original explanatory comments. See
[`lib/dd-engine/README.md`](../../lib/dd-engine/README.md) for the file-by-file
provenance and the list of what changed.

---

## 1. The shape of the port

One directory, `lib/dd-engine/`, containing:

- **the engine**, copied — `strokeTo3d.ts` (all four builders, 2147 lines,
  imports only `three`, so it needed no adaptation at all), `markIntent.ts`,
  `convert.ts`, `conversionMap.ts`, `coverage.ts`, `deskRenderMode.ts`,
  `fallbackLadder.ts`, `hardPath.ts`, `sealedRelief.ts`, `modeParams.ts`,
  `materials3d.ts`, `rodAdornments.ts`, `handFeel.ts`, `f3HandFeel.ts`;
- **`external-types.ts`**, five string unions re-declared verbatim from the Desk
  Doodles modules that sit outside the engine, so the port did not have to drag
  their 2D classifier and a React context tree along with the geometry;
- **`adapter.ts`**, Free Stroke's `GeometryEngine` implemented on top of the
  ported builders. All framework adaptation lives here. Nothing adapts inside a
  port.

`lib/engine-registry.ts` resolves `(mode, family)` to an engine. It is a separate
file rather than a branch inside `geometry-engines.ts` because the adapter
imports *from* `geometry-engines.ts`, and registering there would be a cycle.

**Free Stroke's engine is not deleted, not modified, and still the default.**

### The one decision worth arguing about

Free Stroke maps the canvas's long side to 3 world units. Desk Doodles maps
800px to 8. The adapter runs the whole Desk Doodles pipeline **in Desk Doodles'
units** and then applies one uniform scale, `k = 300 / max(w, h)`, to the
finished geometry.

The alternative — hand their normaliser Free Stroke's scale — looks simpler and
is wrong. Their tuning is a web of absolute world lengths, and most of them have
no option to override: `ROD_RESAMPLE_SPACING` 0.04, `DEDUPE_MIN_DIST` 0.00267,
`MIN_EXTRUDE_AREA` 0.005, `SOLID_MIN_LOOP_AREA`, the `CLOSE_GAP_PX × WORLD_SCALE`
world-closure test, Inflate's base-radius-to-length clamp. Run at a third of the
scale they were tuned at, those constants silently redefine what counts as a
duplicate point, a closed loop, a degenerate area and a corner. That is their
engine *mistuned*, which is the exact failure this port exists to avoid.

`k` works out to 0.3 on a ~1000px canvas — the same DD→FS factor
`docs/research/extrude-solid-quality.md` derived independently, and the exact
inverse of the `×8/3` Desk Doodles applied when it took Rod *from* Free Stroke.

---

## 2. The bug the port surfaced in five minutes, and why it matters

The first capture wrote a folder of PNGs that all had the same MD5.

Desk Doodles' `buildRodGeometry` fills `capPositions` inside `if (!canClose)` —
so a **closed** loop gets `capPositions: []`. Free Stroke's `RodEngine` always
returns exactly two, and the viewport takes that contract at its word:

```ts
if (endCap && strokeMeshData.capPositions) endCap.position.copy(strokeMeshData.capPositions[1])
```

An empty array is truthy. `[1]` is `undefined`. `.copy(undefined)` throws
*"Cannot read properties of undefined (reading 'x')"* — every frame, inside
`useFrame`. The render loop dies, the canvas keeps its last good frame, and the
capture script cheerfully writes fifty identical stale images that look exactly
like evidence.

Two things to take from that. The fix is one line in the adapter (empty →
`undefined`), not in the port and not in the viewport. And **a capture harness
that does not check its own frames differ is not a harness**, which is why
`verify-engine-ab.mjs` now reads back engine, mode and material before every
unit, and why `assert-taper-envelope.mjs` refuses any frame that is not the
1920×1080 capture target.

---

## 3. What it looks like, per mode

Captured headed (Chrome, `--use-angle=metal`), on **glossy plastic** — specular
is a derivative operator on the normal field, so gloss is the register that
*shows* the defects matte hides. 32 units × 39 frames, plus video, under
`docs/verification/engine-ab/port/`. Acceptance fixture is the literal word
"Desk Doodles".

### Rod — **Desk Doodles wins, on the specific complaint**

Both render the word cleanly and neither shows ring banding at the
magnifications captured. The difference is measurable rather than dramatic:

| | meshes | vertices | triangles |
|---|---|---|---|
| Free Stroke | 253 | 32,169 | 49,840 |
| Desk Doodles | 111 | 36,239 | 63,248 |

Same 16 strokes, same 32 caps — Free Stroke stamps **205 joint spheres**, Desk
Doodles stamps **63**. That is a 3.3× reduction in exactly the thing the brief
calls *"ball joints stamped at ends and bends"*, and it is not a threshold
difference: their joint dedup is *tighter* than ours (`radius × 0.75` vs
`TUBE_RADIUS × 1.8`), which should produce *more*. It comes from **where** they
detect. Their comment says it outright:

> Joints detect on the SPARSE anchors (one sphere per real corner — the tube can
> only crease at an anchor turn); the tube itself builds from the DENSE
> resampled centerline

Free Stroke detects joints on the dense curve, so a smooth arc accumulates beads
that have no corner to fill. Desk Doodles detects on the post-RDP anchors, so a
bead only appears where a real corner is. **That is a portable idea independent
of the rest of the port**, and it is the single cheapest thing on this page.

Their higher triangle count is the other half of the trade: their tube is
uniform ×3 tubular segments, ours is curvature-adaptive with a ring table. Ours
is the better sampler; theirs is the better joint policy. They are independent.

### Extrude — **Free Stroke wins for letterforms; they are different modes**

This is not a quality gap, it is a mode identity difference, and
`docs/research/extrude-solid-quality.md §6` predicted it: *"Porting DD's builder
would delete a mode, not improve it."*

- **Free Stroke's Extrude** is a *ribbon swept along an open centreline* —
  calligraphic, direction-bearing. On the word it produces clean glossy
  letterforms. On a circle it produces a hoop.
- **Desk Doodles' Extrude** is a *closed-loop slab* (`THREE.Shape` +
  `ExtrudeGeometry`). On a circle it produces a filled disc with a genuinely
  smooth 3-segment bevel band — their "pressed cookie" read, and the rim shows
  no facets at any orbit angle. On the **word** almost every stroke is open, so
  their LOW-3 guard degrades it to a hairline rod, and one glyph whose endpoints
  happen to fall inside the closure band fills into a slab that dwarfs its
  neighbours. The word is unreadable.

So: take theirs for closed shapes, keep ours for open ones. What is worth
porting from their side is the **bevel profile** and the **contour chain**, which
is what that research doc already recommended and which is already landed in
Free Stroke's own Solid.

### Solid — **Desk Doodles reads better; the mechanism is known**

Both fill the word into a legible solid mass. Theirs has visibly rounder, softer
letterform silhouettes and cleaner counters; ours shows more edge chatter.

The mechanism is not a mystery and it is not resolution — theirs is a **coarser**
grid (`SOLID_GRID_RESOLUTION` 144 vs our 512 raster). It is the order of
operations: decimate at `SOLID_SMOOTH_DECIMATE_EPSILON_CELLS = 1.4` cells to
collapse the marching-squares staircase, *then* run corner-aware multi-pass
Chaikin to rebuild a true curve, pinning genuine corners. Smooth-then-simplify —
the order Free Stroke's `smoothLatticeLoop` used to use — leaves the staircase's
period and amplitude intact and just scallops each step.

### Inflate — **Free Stroke wins, but their taper is the better idea**

At Desk Doodles' own `INFLATE_BASE_RADIUS = 0.22` the word comes out as a row of
fused beads. That is not a defect in their engine; 0.22 world units is a 22px
*radius* on a ~118px letter, about 37% of cap height, and their engine was tuned
on a freehand doodle drawn across an 800×600 canvas where a stroke is long and a
fat capsule reads as a puffy inflated form. A letterform is short and close to
its neighbours. Both states are captured:
`engine-ab/port/word_inflate_desk-doodles` is their raw default,
`engine-ab/inflate-dialmatched/` is the same engine with base radius taken off
the same thickness dial Free Stroke's own Inflate reads (and their tip
*fraction* preserved, per their own "radius-relative factors port verbatim"
rule).

Dial-matched, theirs reads as a legible word of chunky organic strokes with
**visible taper** — the arms of the `k` and the `l` come to points, which is the
pen lifting. Ours reads fuller and more uniform, and **fuses**: Free Stroke's
implicit-field merge resolves crossings into one continuous ink body, where Desk
Doodles' capsules simply interpenetrate, because it has no fusion at all. Their
own backlog names the implicit/marching-cubes merge as the thing they never
built.

So Free Stroke's Inflate is ahead on the structural axis and behind on the
tapering axis, and the taper is the cheaper thing to close.

---

## 4. The taper finding, tested

`docs/research/stroke-width-models.md §3.2` makes a falsifiable prediction: our
end taper `sin(πx/2)^0.8` has `|dr/ds| > 1` near the tip *by construction* (an
exponent below 1 gives the function a vertical tangent at zero), so the swept
surface has **no envelope** there; and because the loft path places rings
perpendicular to the tangent while the implicit path builds exact round-cone
SDFs, the two fusion modes should disagree near every stroke end with implicit
fatter.

`scripts/verify/assert-taper-envelope.mjs` tests both halves.

**The numeric half reproduces exactly.** The envelope first exists at **0.196 R**
in from the stroke end, against the doc's 0.195 R.

**The live half depends on whether the taper zone is big enough to resolve.** The
taper is 0.7 *diameters* long, so at the shipped ink weight it is ~27 screen px:

| run | ink | taper zone | mean implicit/loft | verdict |
|---|---|---|---|---|
| `taper-envelope/port` | default | ~27px | 0.994 | not confirmed |
| `taper-envelope/thick` | max, MC res 8 | ~53px | 1.070 | **confirmed** |

At a weight where it can be seen, the disagreement is real and has the predicted
sign, but its **shape differs from the estimate**: it is concentrated at the
extreme tip — 37.5% fatter at 1% of stroke length, 10.2% at 2% — and has crossed
over to parity by 3%. The doc's 18% figure was quoted for mid-taper; measured,
mid-taper is where the two agree and the tip is where they diverge. Which is
what you would expect if the dominant term is the region where the envelope does
not exist at all, rather than the region where it merely tilts.

Practical reading: **"which fusion mode" is quietly also "which stroke ending",
but only at heavy ink.** Fixing the exponent so `|dr/ds| ≤ 1` closes the parity
break and removes an undefined-surface region for the cost of one constant —
which is exactly what that research ranks second, behind the nib.

---

## 5. What is NOT in this port, and why

**The nib.** `stroke-width-models.md` makes the case that direction-dependent
width is the largest remaining lever, and that it costs one 3×3 matrix because
`c ⊕ A(B₁) = A(A⁻¹(c) ⊕ B₁)` — pre-transform the centreline, sweep the round
tube, map the vertices back. That is true and it is cheap. It is also **not a
port**: Desk Doodles has no nib model, so there is nothing to bring across, and
that same research says so directly — *"this is a gap in both codebases."*
Building it inside a port task would blur the one thing the brief was emphatic
about. It is sequenced separately.

Worth recording for whoever picks it up: the adapter is the natural home for the
Desk Doodles side, because `A⁻¹` on the centreline and `A` on the vertices are
both pure boundary transforms and would not touch a ported file.

**`csg.ts`**, the manifold-WASM deep-relief pass — it needs a WASM dependency
this repo does not carry and 75 KB of Desk Doodles' 2D rasteriser. It carves
relief into a form that already exists; it is not a stroke→geometry builder.

**`Stroke3DScene.tsx` / `HardMesh.tsx`** — React scene components. Their
geometry-side content is the builders (ported), the rod adornments (ported) and
the material/mode tables (ported); what remains is R3F wiring against a context
tree Free Stroke does not have.

---

## 6. Running it

```bash
# side-by-side capture, glossy, headed, video + stills
node scripts/verify/verify-engine-ab.mjs --label=run1
node scripts/verify/verify-engine-ab.mjs --label=bend --shapes=bend --modes=rod,inflate

# the taper prediction, numeric + live
node scripts/verify/assert-taper-envelope.mjs --label=port
node scripts/verify/assert-taper-envelope.mjs --label=thick --thickness=64 --resolution=8

# regression net — expected UNCHANGED, because the default engine did not move
node scripts/verify/geometry-baseline.mjs --compare=dd-port-before,dd-port-after
node scripts/verify/verify-gates.mjs
```

In the UI the switch is a pill row in the header on `/` and on `/desk-doodles`.
For scripts: `window.__styleHarness.setEngine("desk-doodles")` on the lab route,
`window.__engineHarness.setEngine(...)` on the hero route.

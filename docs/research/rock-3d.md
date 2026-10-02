# Rock-3D — the engine, and what Free Stroke should take from it

*Rock-3D is a sibling codebase, not a paper. Read from source in
`~/Desktop/Projects/portfolio/portfolio-system-lab/`, not from its own summaries
— several of which are stale, and are flagged where they are. Half of it is a
converged system worth adopting; half is a cautionary tale. This doc separates
them, then turns the first half into a ranked list of things to actually do.*

---

## The bottom line

Rock-3D is **two engines filed under one name**, and they are not comparable.

**Stage 1 — flat → 2.5D — is a converged, measured, dataset-backed system.** It
is `signals → classify → params → render`: a scale-invariant feature vector, a
region classifier with published gates, a rule engine that documents itself as a
stand-in for a regressor, and a single oblique throw with real hidden-line
removal. Eight audit passes across 197 objects took it from 59 clean to 162,
high-severity 15 → 0, behind a machine-checked regression gate.

**Stage 2 — 2.5D → rotatable — is not a system.** One letter works. Its live
part classifier is an SVG-tag `switch`. The principled classifier written to
replace it sits dead. Three of its four per-role depths are numbers landed by
eye, and the fourth is a bare literal that does not scale at all.

The asymmetry has one cause, and Stage 2's own spec names it:

> The 2d Rock-3D engine converged over 8 passes on 197 objects **without Sebs
> eyeing each one** because it had a **measurable check** … The 3d rotatable has
> been gated by **subjective eyeballs** … **You cannot self-train against a
> broken check.**
> — `ROTATABLE-SELF-TRAIN-CHECK.md:5`

**What Free Stroke should take is not the look.** It is the four things Stage 1
has that Free Stroke does not: a stage that *reads* its input before rendering
it, a rule layer honest about being provisional, occlusion as an explicit
computation, and a harness whose stated job is to catch a specific dishonest
shortcut. Section 6 ranks those with costs and payoffs. Sections 1–4 are the
evidence; section 5 is the narrower question of the hero beat.

**And both codebases share one pathology**, which is worth naming before either
is praised: each has a correct classifier sitting on disk that nothing calls.
Rock-3D's is `recognize()`; Free Stroke's is `markIntent.ts`. Section 6.0.

---

## 1. The model — and why only one stage is a "style"

The reference is `docs/system/ROCK3D-DESK-DOODLES-ARCHITECTURE.md`, aligned
2026-07-09:

> **197 (our seed) → vision/features → smart(rules)+ML(trained) classify the FLAT
> → style render** *(flat styles = simple; Rock-3D-2.5D = the complex style)*
> **→ rotatable = auto 2.5D→3D construction** *(the new, unowned decision domain)*
> **→ user drawings via the approval gate grow the training set.**
> — `ROCK3D-DESK-DOODLES-ARCHITECTURE.md:11-13`

> 1. **Rock-3D-2.5D is essentially a STYLE** — the same slot as the flat
>    hand-drawn styles, with a far more complicated pipeline (classify →
>    oblique-throw → hidden-line → nib/wonk). It is not "3D"; it is a look.
> 2. **The rotatable is the one piece that is MORE than a style** — it is the
>    *auto 3D version* … **No layer owns this yet.**
> — `ROCK3D-DESK-DOODLES-ARCHITECTURE.md:16-20`

The two conversions are different problems. Desk-doodles goes flat → 3D with no
ground truth and builds geometry from scratch. Rock-3D goes 2.5D → 3D, and **the
2.5D head-on view IS the ground truth**. The consequence the doc draws is the
template for this whole document, applied in reverse:

> **desk-doodles' geometry builders do not lift into our rotatable.** … **What
> DOES transfer is one stage earlier — the *reading* of the flat drawing** ("this
> loop is a hole, this is the body, this is a detail/band").
> — `ROCK3D-DESK-DOODLES-ARCHITECTURE.md:33-38`

### Three engines, not one

`ROCK3D-ENGINE-COMPLETE.md:10-24` separates them, and conflating them is named
as a cause of the rotatable failures:

- **Engine A — the object faux-3D engine.** `rock3d.js` + `signals.js` +
  `ruleEngine.js` + the dispatcher in `lab.html`. Doodle SVG in, one hollow
  hand-drawn oblique-extruded **flat SVG** out. This is what "the Rock-3D engine"
  means in practice, and it is the only one relevant here.
- **Engine B — the glyph medial-axis reproduction.** `skeleton.js` + `pen.js`.
  A *reconstruction* pipeline for the Shibuya Rock-3D font, not a 3D one. §5.3
  explains why the port must not touch it despite the name.
- **Engine C — the WebGL runtime.** `rock3dRuntime.ts`. The only one producing a
  real mesh today, and it is "extrusion + a slab hack, not a solved turnaround."

---

## 2. Stage 1, in detail — the half that works

### 2.1 Signals — `signals.js` → `window.rockSignals(pathD)`

53 lines. Resample to **120 points** by arc length, return a scale-invariant
vector:

| field | formula |
|---|---|
| `aspectRatio` | `w / h` |
| `fillRatio` | `polyArea / (w·h)` |
| `solidity` | `min(1, polyArea / hullArea)`, hull by monotone chain |
| `compactness` | `perimeter² / (4π·area)` — isoperimetric, 1.0 for a circle |
| `cornerCount` | points with turning angle `> 0.5` rad |
| `meanTurn` | `Σ|turn| / n` |
| `subpathCount` | `d.split(/(?=[Mm])/)` length |
| `pointComplexity` | `perimeter / sqrt(area)` |

`pointComplexity` carries the most instructive bug in the codebase, and the fix
comment is still in the file:

> scale-invariant raggedness (perimeter / sqrt(area)) — was P.length, which is
> **ALWAYS the resample count (120)** → a useless constant that floored every
> object's depth via the busy gate.
> — `signals.js:43-46`

A feature that was secretly a constant, feeding a gate that therefore fired on
every object. **Every object in the catalogue was depth-shy for months** and it
was invisible because the number looked like a measurement.
`ROCK3D-ENGINE-COMPLETE.md:220` lists it as failure #1 of the whole build.

### 2.2 Classification — `rockRegionKind`

`rock3d.js:1767`. Its own header states the taxonomy:

> COUNTER = enclosed clean-window hole (rect/ellipse screen, source-transparent) -> 3-D ring;
> TEXTURE = packed/repeated ruled/woven/hatched marks → faint flat, no depth;
> CONTENT = a single applied drawing / sticker / text / label → flat, no depth, medium weight.
> — `rock3d.js:1763-1766`

**The hole rule is a conjunction of three predicates** (`rock3d.js:1850`):

```js
if (rockIsWindowFill(pa.fill) && rockIsCounter(pa, allPaths, rep, objArea) && rockIsCleanWindow(pa))
  return 'counter';
return 'content';
```

**`rockIsWindowFill(fill)`** — `rock3d.js:1762`, the host-context gate:
```js
const f = (fill == null ? '' : String(fill)).trim();
return f === 'transparent' || f === 'none';
```
A region painted with ink, a background knockout or a body tint is a *drawn
mark*, never a hole. One line; it is what stops printed labels, mastheads and
keypads from being box-extruded as windows.

**`rockIsCounter`** — `rock3d.js:1596`:
```js
if (a < objArea * 0.09) return false;                 // too small → printed detail
if (bigPeers > 2) return false;                       // grid/array of cells → texture
if (a / hullArea(pa.pts) < 0.7) return false;         // ragged/thin/branchy → not a clean window
```

**`rockIsCleanWindow`** — `rock3d.js:1694`, separating a geometric opening from
an organic drawing at the same fill ratio:
```js
if (fill > 0.82) return true;                              // rect / rounded-rect screen
if (fill > 0.62 && radialLobes(pa.pts) <= 2) return true;  // clean circle / ellipse window
return false;                                              // organic / irregular → content
```
`radialLobes` is `r(θ)` from the centroid, smoothed twice with a 3-tap box, local
maxima above `mean · 1.05`. Circle ≈ 0, ellipse ≈ 2, rect ≈ 4, organic ≥ 3. Its
comment names the failure it was written for: `rockIsCounter` "rang inktoberCard's
leaf drawing as a counter."

**Round-form detection** is deliberately split in two. `rockIsRound`
(`rock3d.js:1707`) is strict — circularity `4πA/P² > 0.80` **and**
`radialLobes ≤ 2` — and gates *classification*. `rockIsRoundForm`
(`rock3d.js:1722`) is eccentricity-tolerant and gates only the *depth magnitude*:
```js
return fillRatio >= 0.72 && fillRatio <= 0.83 && aspect <= 6 && radialLobes(pts) <= 2;
```
`0.785 = π/4` is the ellipse signature. **One strict predicate for routing, one
loose predicate for rendering** is a good pattern and a real finding.

**Texture** — `rockIsTextureMark` (`rock3d.js:1654`) fires on ink-length density,
total mark count, or a packed parallel grating. Constants at `rock3d.js:754-763`:

| constant | value | meaning |
|---|---|---|
| `C3_DENSE_RATIO` | `3.0` | ink-length ÷ bbox-perimeter above this → packed texture |
| `C3_THIN_ASPECT` | `4` | bbox long/short above this → a line, not a shape |
| `C3_THIN_FILL` | `0.20` | poly-area ÷ bbox-area below this → a thin stroke |
| `C3_MIN_LINES` | `4` | minimum line-like marks to be a grating at all |
| `C3_PACK_RATIO` | `0.15` | spacing ÷ length below this → packed scanlines |
| `C3_DENSE_TOTAL` | `16` | this many flat marks of any kind → busy/woven face |
| `C3_FAINT_WEIGHT` | `0.40` | texture-tier weight |

`C3_FAINT_WEIGHT` is a taste number with a citation, which is the point:

> texture-tier weight (learning obj2: 3-tier line-weight hierarchy — outline
> heaviest, depth medium, interior texture lightest ~0.4× outline = ~2.5:1, the
> architectural-graphics ratio). **Replaces the hand-guessed 0.26.**
> — `rock3d.js:763`

**Honest limit.** `rockRegionKind` is 85 lines and *eight* branches are named
escape hatches — `CONCENTRIC-IN-ROUND guard`, `ROUND-ON-BLOCK-FACE gate`,
`PORTHOLE gate`, `COVER-PANEL gate`, `SMALL-RECT-LABEL-ON-FACE gate`,
`STRUCTURAL-THIN guard`, `DENSE-SCRIBBLE`, `STRAY-ISLAND SUPPRESSION` — each
citing the object that forced it (sombrero, nintendoPowerMag, glassBottleTopo,
foldingChair, framedFlyer). Every one is expressed as geometry rather than an
object id, so the discipline holds. But this is a rule engine with a long tail,
and the tail length is the argument for the learned provider it says it is a
stand-in for.

### 2.3 Params — `ruleEngine.js` → `window.rockChooseParams(features)`

37 lines, stating its own status in the header:

> Deterministic rules now (rule engine), **the documented foundation for a
> kNN/regressor later** (each {features, params, label} row trains it).
> — `ruleEngine.js:1-3`

**The throw formula, verbatim** (`ruleEngine.js:14-17`):
```js
const nBody = f.nBodyElements || 1;
const busy  = nBody > 6 || f.compactness > 6.5;
const throwMag = clamp(0.27 - (busy ? 0.05 : 0) - (f.compactness > 4 ? 0.015 : 0), 0.21, 0.31);
```

⚠️ This is **not** the formula the architecture doc quotes. That doc says
`throwMag = clamp(0.27 − busy − compactness, 0.21, 0.31)`, which reads as if both
terms were continuous. They are **step functions** — `−0.05` and `−0.015` — and
`busy` is itself a boolean over `nBodyElements`. The whole engine's depth lives
on four discrete values: `0.27`, `0.255`, `0.22`, `0.205`. The paraphrase is
close enough to mislead.

The rest:
```js
const edgeCap     = clamp(Math.round(3 + f.cornerCount * 0.6), 5, 14);
const concavity   = clamp(1 - f.solidity, 0, 1);
const depthLenJit = clamp(0.30 + concavity * 0.45, 0.30, 0.62);
const depthAngJit = clamp(0.34 + concavity * 0.30, 0.34, 0.60);
const roughFront  = clamp(1.25 + concavity * 0.40, 1.25, 1.75);
```

`concavity = 1 − solidity` driving three jitter knobs off one measurement is the
nicest move in the file, and it is sourced to a technique rather than to taste:

> Concave / ragged shapes get more hand-thrown variance (per the sign-painter
> "eyeball the back, it's fine if it's not the same" rule); round/solid shapes
> stay cleaner.
> — `ruleEngine.js:20-22`

### 2.4 The oblique cavalier throw

There is no camera, no z, no projection matrix.

> **Projection**: not a matrix projection. It is a **2D oblique translate**: every
> 3D point is `front_point + depth·throwBase`. This is a **cabinet-oblique**
> convention (k≈0.5, `throwMag≈0.25`), applied *in screen space*.
> — `ROCK3D-ENGINE-COMPLETE.md:126-129`

**`throwBase = [0.84, 0.46]`** — ≈28.7° below horizontal-right — and it was 180°
wrong for the first month:

> DOWN-RIGHT throw (font-verified 2026-06-26 against I/L/E/T/Z/F real glyphs:
> depth band sits on the RIGHT, extrusion boxes hang BELOW each arm → lit from
> upper-left, shadow falls lower-right). Was [-0.84,-0.46] (up-left) = 180° wrong.
> — `rock3d.js:10-13`

⚠️ **The live file's own header still says the opposite.** Line 3 reads "oblique
extrusion thrown **UP-LEFT**" — pre-correction text sitting four lines above the
corrected constant, and identically stale in all three parked snapshots
(`rock3d.PRE-RIM.js`, `rock3d-multistroke.js`, `rock3d-faceimg.js`). Read
constants, not comments.

**Depth magnitude** (`rock3d.js:1199-1200`), keyed to the short axis and bounded
by the contour's own narrow side:
```js
const sa  = Math.min(P0.objMin || pathMin, pathMin);
const mag = Math.min(sa * 0.85, Math.max(Math.min(12, sa * 0.5), P0.throwMag * sa));
```
Three derived magnitudes (`rock3d.js:1207-1220`):
```js
const magBody  = (aspR > 4 && fillR < 0.45) ? Math.min(sa*0.85, mag*1.5) : mag;  // thin-shaft boost
const magOuter = isRound ? Math.min(magBody, mag * 0.5) : magBody;
const magHole  = mag * (isRound ? 0.25 : 0.55);
```

⚠️ **`ROCK3D-ENGINE-COMPLETE.md:317` still lists round-form depth as `mag·0.34`.**
Live is `mag · 0.5`, changed 2026-07-04 because "round/disc bodies … read FLAT at
0.34" (`rock3d.js:1219`).

⚠️ **The knee.** That `max(min(12, sa·0.5), …)` floor means the throw saturates
on small forms. Measured on the portfolio's hover lab, where `objMin ≈ 25–27`:

> On these objects **every `throwMag ≤ ~0.44` clamps to the same 12px throw.**
> — `hover-rock3d-object.md`

Per-object knees: `seltzerCan 0.441 · raceMedal 0.482 · eraserBlock 0.457 ·
capPen 0.500`. Two other documents' depth numbers were invalidated by this and
one is annotated "**stale — do not re-derive from it**." Any port that exposes
`throwMag` as a dial must know where its dial stops doing anything.

**The side walls are real polygons, not strokes** (`rock3d.js:1085-1092`):
```js
const front = close(P);
const polys = [[front], [close(P.map(p => [p[0]+tv[0], p[1]+tv[1]]))]];
for (let i = 0; i < N; i++) { /* per-edge quad front[i]→front[i+1]→+tv */ }
const sweep = polygonClipping.union(polys[0], ...polys.slice(1));
depth = polygonClipping.difference(sweep, [front]);
```
A bounded **Minkowski sweep of the contour along the throw, minus the front
face**, with the property that makes it worth copying:

> Because it's the bounded swept region, the depth can **NEVER** over-curve,
> sliver, spike past the base, or loop.
> — `rock3d.js:1082-1084`

This was the largest single quality jump in the project: clean objects
**59 → 137** in one pass (`ROCK3D-ENGINE-COMPLETE.md:224`). The naive
alternative — offset the contour and stroke it — produced over-curve, blobs,
slivers and spikes on **96 of 197** objects across four passes of increasingly
clever corrections. **Sweep-and-subtract is provably bounded; offset-and-stroke
is not.**

**Creases** are throw lines at interior corners only, `front[i] → front[i]+tv`,
corner threshold `0.44` rad, count capped by `edgeCap` (`rock3d.js:1138-1141`).
Drawing them at every point is what reads as a scribble.

### 2.5 Even-odd holes and hidden-line occlusion

Four lines, and the whole difference between a solid block and a wireframe
(`rock3d.js:1229-1241`):

```js
// 2. OCCLUDER (hidden-line removal → almost-solid): opaque paper fill of the
//    front face hides the depth behind it; evenodd keeps real holes open.
occ.setAttribute('d', pathD);
occ.setAttribute('fill', _solid ? P0.ink : P0.paper);
occ.setAttribute('fill-rule', 'evenodd');
// 3. INNER counters/holes → 3-D rings, ON TOP of the occluder so they read recessed.
for (let i = 1; i < subs.length; i++) extrudeContour(svg, rc, subs[i], magHole, P0, rand);
```

Draw order: **depth walls → opaque paper occluder (evenodd) → hole rings on top
→ front outline on top.** The object reads *hollow* because paper is the page
colour, and reads *solid* because that same fill occludes the depth behind it.

> **This is the single thing that separates a solid Rock-3D block from a
> transparent wireframe.**
> — `ROCK3D-SPEC.md:19`

Versions 1–8 were x-ray wireframes with all depth showing through. The fix is one
opaque path in the right place in the draw order.

⚠️ **The hollow invariant has since been overridden** by an owner lock: "**Rock-3D
is SOLID, not hollow.** The engine's 'hollow paper occluder' (old invariant B6) is
**overridden**" (`DECISION-IDEA-MAPS/rock3d-material.md:5`), implemented as the
reversible `window.ROCK_FILL_SOLID` hook that fills the front face with ink
instead of paper. The *mechanism* is unchanged — an opaque front-face fill in
draw order — only its colour.

### 2.6 `ROCK_CAPTURE` — what the engine hands downstream

Default-off, guarded, byte-identical when unset (`rock3d.js:1180-1184`). When
`window.ROCK_CAPTURE` is an array, one record per object
(`rock3d.js:1257-1266`):

```js
_cap.push({
  kind: 'rock3d', pathD, subs: subs.slice(),
  tv: [P0.throwBase[0] * magOuter, P0.throwBase[1] * magOuter],
  mag, magOuter, magHole, isRound,
  ink, paper, wFront, wBack, wEdge, throwBase,
  walls: window.__ROCK_CAP_WALLS || [],
});
```
and one per wall from `extrudeContour` (`rock3d.js:1148`):
```js
window.__ROCK_CAP_WALLS.push({ P, tv, mag, depth, creases: creaseSegs, isRound, recess });
```

So: **front contour + throw + wall polygons + crease z-edges + the counter/hole
split.** What that does *not* include is the reason Stage 2 is hard:

> **True 3D depth per point.** `tv` is a *single global* down-right offset
> (cabinet-oblique in screen space). There is no per-point z, no real surface
> normal … the "walls" are a constant-offset ruled band, correct only for the
> head-on/near-head-on view.
> — `ROCK3D-ENGINE-COMPLETE.md:183-185`

### 2.7 How it converged

Eight granular audit passes over all 197 objects (`learning/loopback8-summary.md`):

| Pass | Clean | Defective | high | med | low |
|---|---:|---:|---:|---:|---:|
| 4 | 59 | 138 | 15 | 68 | 55 |
| 5 | 137 | 60 | 2 | 14 | 43 |
| 6 | 151 | 46 | 0 | 4 | 41 |
| 7 | 164 | 33 | 0 | 4 | 29 |
| 8 | **162** | **35** | **0** | **0** | **35** |

Pass 8's defect count went **up by 2**, and the summary defends it:

> This is the first pass where defective count ticked UP — and it is the right
> kind of up. … the aggressive line-weight re-anchor … made the catalog's lines
> THINNER and the renders SHARPER — which exposed a handful of previously-masked
> low residuals … that the heavier line had visually swamped.

The severity floor is the real signal: high 15 → 0, med 68 → 0.

**The regression gate** is `check-invariants.mjs`, read-only, rendering each
object and measuring the produced SVG back (`learning/STYLE-FIDELITY-CHECKLIST.md`):

| Invariant | Pass band |
|---|---|
| **A1** main-outline weight ÷ calibrated control | `0.7–1.35×` |
| **B6** front face paper/none, never solid ink | hollow, 197/197 *(now owner-overridden)* |
| **B7** depth vector · `[0.84, 0.46]` | `≥ 0.90` (within ~25°) |
| **B8** depth extent past silhouette | `≤ 1.05 × short axis`, no self-intersection |
| **C10** counter/content/texture/array routing counts | a diff-to-diff **flip** flags |
| **INK** total ink fraction of bbox | `0.02–0.55` |

Explicitly *not* covered, left to a human pass every loop: smoothness,
broad/thin contrast, weight consistency, corners/terminals, hand-wonk, occlusion,
identity.

**The two governing meta-rules**, both emphatic, both from the owner:

> **"The metric is a tripwire, never proof."** … A green gate = "no measured
> regression," NOT "looks right."

with the case attached: a gate reported "A1 128→2, PASS" and was closed *while
fat black recess blobs were still sitting on gameBoy*, because the metric
measured only the main outline.

> **"Always the root-cause fix, never the lazy number-nudge."** … Rule of thumb:
> tweaked a number twice and it's still off → the approach is wrong, swap it.

with its own case: `recessMag 2.0 → 1.0` failed twice because the *mechanism* (a
filled swept band) was wrong. The fix replaced the mechanism — filled band → thin
hairline stroke on the shadowed edges.

### 2.8 The constants, in one place

| Constant | Value | Source |
|---|---|---|
| `throwBase` | `[0.84, 0.46]` | `rock3d.js:13` |
| `throwMag` default | `0.25`; rule engine `0.205–0.27`, clamp `0.21–0.31` | `rock3d.js:13`, `ruleEngine.js:17` |
| depth clamp | `min(0.85·sa, max(min(12, 0.5·sa), throwMag·sa))` | `rock3d.js:1200` |
| round-form depth | `mag · 0.5` *(docs say 0.34 — stale)* | `rock3d.js:1219` |
| hole depth | `mag · 0.55` (round `0.25`) | `rock3d.js:1220` |
| thin-shaft boost | `×1.5`, gated `aspect > 4 && fill < 0.45` | `rock3d.js:1207` |
| corner threshold | `0.44` rad | `rock3d.js` `corners()` |
| `edgeCap` | `clamp(3 + corners·0.6, 5, 14)` | `ruleEngine.js:19` |
| nib (object) | `angle −0.7 rad, broad 1.26, thin 0.81` (≈1.56×) | `rock3d.js:76-80` |
| nib (glyph pen) | `angle −0.6, broad 1.25, thin 0.78` (≈1.68×) | `pen.js:205-207` |
| line scale | `clamp(objMax / 138, 0.40, 1.0)`, later `objMax / 82, 0.40, 1.7` | `rock3d.js` `lineScale` |
| stroke smoothness | `ROUGH_FRONT 0.45, ROUGH_BACK 0.5, ROUGH_EDGE 0.4, BOWING 0.35` | `rock3d.js:22-25` |
| standing wonk, objects | `amp 0.14, freq 3, tang 0.55, seed hashStr(id)` | `OBJECT-STRENGTH-AUDIT.md` |
| standing wonk, UI marks | `amp 0.06` | `OBJECT-STRENGTH-AUDIT.md` |

The low `ROUGH_*` values encode the finding worth carrying:

> Rock 3D was hand-drawn **THEN VECTORIZED** → the LINES are smooth single
> strokes; only the SHAPES are wonky. We had rough.js roughness ~1.2-1.8 +
> double-stroke = a hairy scribble (**wonk in the wrong place**).
> — `rock3d.js:17-21`

**Put the hand in the geometry, not in the stroke.** `handwriting-variability.md`
reaches the same conclusion from the kinematics side — per-vertex noise on a
stored polyline "reads as damage" — arrived at independently.

---

## 3. Stage 2 — the rotatable, honestly

*Read this section sceptically. It is where the discipline of Stage 1 stops.*

The architecture doc's own verdict is "AD-HOC — the gap"
(`ROCK3D-DESK-DOODLES-ARCHITECTURE.md:59`). All three of its charges check out
against source.

### 3.1 The live classifier is an SVG-tag switch

`rotatable-solid/skeleton-capture.mjs:50`, `parseDetails(markup)`, harvested by a
tag regex over the raw markup. Condensed from lines 66–70:

```js
if (e.type === 'circle')       details.push({ role: 'lid',    ring: /* 24-pt circle */, open: false });
else if (e.type === 'polygon') details.push({ role: 'spout',  ring: pts, open: false });   // unless top-2 by area
else if (e.type === 'path')    details.push({ role: 'handle', ring: flattenPath(d), open: true });
else if (e.type === 'line')    seam = [[x1, y1], [x2, y2]];
```

`<circle>` → lid. `<path>` → handle. `<line>` → seam. `<polygon>` → spout, unless
it is one of the two largest, which are the captured bodies. That last clause is
the only geometric validation in the function.

**A tag dispatch is not a classifier.** `<circle>` → lid is a statement about how
the SVG was *authored*, not about what the geometry *is*. It cannot generalise
past drawings whose author used those tags, and it cannot be wrong in a way a
test could catch, because there is nothing to be wrong about. `rockIsRound` —
circularity `> 0.80` and `radialLobes ≤ 2` — can be measured, falsified and
swept. Stage 1 spent eight passes learning to key off geometry. Stage 2 keys off
markup syntax.

It carries a tombstone declaring itself superseded
(`skeleton-capture.mjs:46-49`):

> ⚰️ SUPERSEDED (Stage-2, 2026-07-09) — the crude SVG-tag dispatch (circle→lid,
> path→handle, polygon→spout, line→seam) is no longer wired into the pipeline; the
> rotatable reads the engine's real classification via `window.__ROCK_FEATURES`. …
> **DO NOT re-wire — that's the tag-dispatch we killed.**

**It is still called**, at `skeleton-capture.mjs:112`, with a second comment
explaining why the tombstone is wrong:

> RESTORED (loop 2): parseDetails supplies the detail RINGS (lid/spout/handle) +
> seam. The engine's rockRegionKind features are region-KIND only (4× "content");
> they do NOT carry the per-detail rings, so this source is still required —
> killing it is why the details vanished.
> — `skeleton-capture.mjs:109-112`

That is the actual finding, and it is more interesting than "the classifier is
bad": **Stage 1's reading was not rich enough to replace it.** `ROCK_CAPTURE`
emits region *kinds*, not per-detail *rings*, so the principled path had nothing
to hand the geometry builder. The tag dispatch survives because the thing meant
to replace it is under-specified, not because nobody tried.

### 3.2 The better classifier exists and is dead

`rotatable-solid/rock3d-solid.mjs:187-218`, `recognize(parsed)`. Its thresholds
are the principled alternative:

```js
if (e.open && bb.h < objMin * 0.06 && bb.w > allBB.w * 0.4)  role = 'seam';
else if (!e.filled)                                          role = 'handle';
else if (e.circle && bb.cy < allBB.cy && bb.w < objMin * 0.5) role = 'cap';
else if (frac >= 0.18 && bb.h > allBB.h * 0.28)              role = 'body';
else if (frac < 0.12)                                        role = 'spout';
else                                                          role = 'plate';
```

Area fraction, bbox aspect, position relative to the centroid, open/closed,
filled/unfilled — all measurements of the shape. It also emits a **different role
vocabulary** (`seam · handle · cap · body · spout · plate`) from the one
`parseDetails` produces (`lid · spout · handle · seam`), which is part of why
swapping it in is not a drop-in.

It is imported only by three superseded stages (`stage.html`, `ink-stage.html`,
`finish-stage.html`) and by nothing live. Its author's status note:

> `recognize()` in `rock3d-solid.mjs` — I did NOT delete it: it's only imported by
> the OLD superseded stages … not the live skeleton pipeline, so it's already
> dead w.r.t. us.
> — `docs/system/comms/from-fae.md:511`

**Why this matters more than it looks.** A correct replacement produced no
measurable improvement to point at, because the gate at this stage was an eye.
With nothing to show, the incumbent never got displaced. That is the mechanism by
which good code goes dead, and §6.0 shows Free Stroke has the identical case.

### 3.3 The magic depths

`rotatable-solid/skeleton-stage.html:293-300`:

| role | depth | line | note |
|---|---|---|---|
| `body` | `bb.w * 0.82` | 293 | body bbox **width**; comment: *"a moka is ~as deep as it is wide → believable solid"* |
| `lid` | `min(cb.w, cb.h) * 0.95` | 298 | detail ring short axis |
| `spout` | `min(cb.w, cb.h) * 1.1` | 299 | |
| `handle` | **`const Dh = 3.2`** | 300 | a bare literal — no scaling of any kind |

Three of four at least scale with the form. `handle = 3.2` does not, which makes
it the most brittle number in the lane: it is correct at exactly one object size.
Three numbers for one object; 197 objects at that rate is 197 hand-tuning
sessions, which is what Stage 1 stopped doing at pass 4.

### 3.4 What genuinely works — and is worth taking

**`buildPart(outer, holes, D, partId)`** — `skeleton-stage.html:242`. Front cap at
`z=0`, back cap at `z=D`, wall quads between, earcut triangulation via
`THREE.Shape` with `shape.holes.push(...)`. It returns `{tris, edges}`: `tris`
feed the z-buffer, `edges` are ink candidates with stable ids
(`<partId>:fr<ring>`, `:br<ring>`, `:v<ring>_<i>`). Two details matter:

- **Holes are walled front-to-back**, so a counter stays a through-void from every
  angle rather than becoming a painted-on ellipse.
- **Vertical edges carry a dihedral flag**, `sharp: ang > 30`, and are inked only
  when genuinely sharp *or* on the silhouette this frame
  (`skeleton-stage.html:267`). Without that gate every wall seam inks and the form
  reads as corduroy — the source calls it *"the 'render' tell."*

**The software z-buffer** — `zbuffer(mp)`, `skeleton-stage.html:561-562`. A plain
CPU barycentric triangle rasteriser at `RS = 300` (line 547), `Float32Array`
filled to `1e9`, keeping minimum z. The visibility test is **spine-sampled** — per
point of a stroke centreline, not per fat fragment
(`skeleton-stage.html:605, 618`):
```js
const biasZ = MODEL.half * 0.02;
const sampleVisible = (w) => { const px = mp.toPx(w); … return w[2] <= buf[iy*RS+ix] + biasZ; };
```
and visible samples are chopped into **runs** (`skeleton-stage.html:696`), each
drawn whole at full ink. Binary by construction: a sample is in a run or dropped,
never faded. That is metric M5.

The predecessor used a **sparse point-cloud** z-buffer and read see-through
(`rotatable/shell.js`, with a gap-bridging hack to paper over the flicker); the
fix was filled triangles (`rotatable/shell2.js:204-310`). The research note adds
the caveat that generalises:

> **M5 binary HLR for WIDE strokes:** a plain z-buffer FAILS (the stroke's
> triangle-strip interpenetrates the surface → ghosts).
> — `ROTATABLE-METHOD-FROM-RESEARCH.md:38`

Hence spine-sampling: test the centreline, draw the ribbon.

**The empirical home/shear search** — `skeleton-capture.mjs:159-240`. The oblique
throw is not a rotation, so no camera pose reproduces it by derivation. Rather
than deriving one, it searches:

> Find the (yaw, pitch, shearFrac) whose FIRST-DRAG frame … is pixel-closest to
> the resting flat drawing. **No assumed throw angles — measured.** The winner is
> baked into `model-data.json`.
> — `skeleton-capture.mjs:161`

Three stages: `shearFrac ∈ {0, 0.25, 0.5, 0.75, 1}` → an 8 × 5 yaw/pitch grid at
the best three shears → ±0.75° / ±1° refinement. The objective is deliberately
**coarse** (`skeleton-capture.mjs:187`): downscale both frames to 96×96 grey
and take mean |Δ|, because

> raw per-pixel diff gave a FLAT landscape whose minimum was noise (it picked ±6°
> corners over near-identity).

**The result justifies the whole approach.** Measured (`Rock3dRotatable.jsonl`
row 27), first-drag mean delta against the resting drawing:

| home | meanDelta | changedFrac |
|---|---:|---:|
| **searched** (yaw −2.25, pitch 1, shearFrac 1) | **2.39** | **0.0425** |
| derived from the throw (yaw 16.691, pitch −9.451) | 17.86 | 0.154 |
| naive ortho front (0, 0, 0) | 7.60 | 0.133 |

**The derived value was 7.5× worse than the searched one, and worse than doing
nothing.** A closed-form answer existed, was computed, and was wrong — because the
quantity being matched is a rendered image, not an angle.

### 3.5 The byte-0 short-circuit — the cheat, and its removal

The banned move, as it was actually written
(`skeleton-stage.WORKING-BASELINE.html:389`):
```js
const H = (MODEL && MODEL.home) || { yaw: 0, pitch: 0 };
if (Math.abs(y-H.yaw) < 1e-2 && Math.abs(pi-H.pitch) < 1e-2 && Math.abs(ro) < 1e-2) {
  stage.innerHTML = FRONT.svgOuter; window.__lastMeta = { …, identity: true }; return;
}
```
Within 0.01° of home on all three axes, dump the captured flat SVG and `return`
before any geometry runs. That is the flat card faking the match.

Its author admitted it in the open, which is worth recording as the honest thing
it is (`docs/system/comms/from-fae.md`):

> On skeleton-stage.html I did the BANNED moves — `faceZ=0` flatten (the worst
> offense), re-ink via rock3dFlat, oval-ish revolution, and I leaned on the
> literal-SVG short-circuit CHEAT.

**What replaced it** (`skeleton-stage.html:584, 596-599`) is a *shear fade*: at
home the projection uses the drawing's own cavalier shear (`shear·D = tv`, so a
point lifted to `z = s·D` reprojects to exactly its drawn spot), smoothstepping to
zero over `FADE_DEG = 45°` into pure orthographic orbit.

**And the next build banned the fade too.** `one-engine-capture.mjs:142` greps for
it: `no_shear_fade: !/FADE_DEG/.test(src) && !/dHome/.test(src)`. The reasoning is
that a home-only projection mode is a softer version of the same cheat — the rest
pose is still special-cased. So `skeleton-stage.html` (v1) would fail the
successor's own avoid-list. **Two builds in the same lane are graded by different
avoid-lists**, which is worth knowing before quoting either as "the" standard.

### 3.6 Status, and the v1/v2 contract that no longer holds

Only **R** has a 3D glyph version — confirmed in three places, including a binary
UI toggle (`hybrid-stage.html:907`, `obj = checked ? 'R' : 'moka'`). On the object
side the union of everything ever rotated is **14 ids**, of which two (moka, R)
are hardwired and gated, seven are generated captures on disk, and the rest appear
only in contact sheets or a stale generation summary. Against 197 objects + 36
glyphs, with a `3×` re-green-light close required
(`ROCK3D-3D-ENGINE-LOOPBACK.md:57-61`), and `ROTATABLE-THE-BAR.md:55` stating
**"197 FROZEN"** until the first is perfect.

The `v1 = extrude` / `v2 = revolution` split quoted in §4 **was dissolved**, on
the owner's objection:

> v2 revolves the moka into a smooth CYLINDER — but the moka is a **faceted
> octagon** … *"v2 is supposed to be an IMPROVED v1 — why have a separate
> version?"* He's right — **an improvement isn't a parallel method.**
> … there is no general "v2 revolution." It's **one engine: faceted by default,
> reaching for disc/ball/cylinder ONLY when the object is actually round.**
> — `docs/system/comms/from-fae.md`

The v2 files are quarantined by filename
(`v2-revolution-stage.SUPERSEDED-folded-into-one-engine.html`). The successor
scored reproduction **1.000** against v1's **0.933**, structure **14/14**. So the
read-only-to-the-incumbent contract in §4 is still a good pattern — it is just
recorded here as history, not as the live architecture.

### 3.7 The dead ends, documented as findings

`ROTATABLE-THE-BAR.md:35-43` lists a full day of rejected attempts, and the
meta-lesson generalises past this project:

> Every attempt below was "trash" by Sebs's eye. **They are all the SAME thing (a
> synthesized/extruded solid) re-skinned:** extrude the silhouette → loaf /
> slab · inflate/heightfield → plush BLOB · facet the extrude → pixelated
> low-poly · ink-on-the-extrude → "the extrude with lines on two edges" ·
> SVG-reprojection/onion/billboard → hollow, flat at profile · image-to-3D AI →
> regenerates the object.
>
> **META-LESSON:** iteratively tweaking a renderer in a loop kept producing "the
> same thing slightly changed." More directives did NOT change it. **The next
> attempt MUST be a genuinely DIFFERENT technique, found by real research — not
> another re-skin of the extrude.**

And the diagnosis of the first three lineages is one sentence:

> doodle3d + turnaround both **REBUILD from a clean 2D bake** and **discard the
> throw vector** … They throw away the exact hand and the oblique model — the two
> things the engine already has.
> — `ROCK3D-ENGINE-COMPLETE.md:277-278`

### 3.8 The one genuinely-missing piece, and the refuted method

> The single thing the engine does NOT have is a **real side/back cross-section**
> — its walls are a uniform oblique slab, so exactly edge-on (90°/270°) any of
> these reads as the extruded rectangle. **You cannot recover a true orthogonal
> side profile from ONE head-on drawing without inventing geometry.**
> — `ROCK3D-ENGINE-COMPLETE.md:289-293`

A 104-agent deep research pass returned a deterministic, no-AI chain — View-Dependent
Geometry (Rademacher '99) as the spine, Grimm's implicit generalized cylinder
("worm," '99) for the side/back, Kalnins' Coherent Stylized Silhouettes ('03) to
carry the ink, filled-triangle z-buffer HLR (Appel / Cole) for occlusion — with
this at the top:

> **No single published method solves the exact stated problem** … so the ranked
> answer is a deterministic HYBRID … The one unresolved risk is that VDG's
> exact-reproduction-at-the-key-view property (**the head-on pixel-exact
> guarantee**) was NOT confirmed in verification.

**That is the whole plan's load-bearing assumption, and verification refuted it**
(1 claim killed of 25 verified, vote 1-2). Grimm worms are also documented to suit
forms that are "fundamentally a cylinder." The method is a composition of four
separately-validated papers, not a validated pipeline — the research says so
itself, and it is the reason this is filed as a dead end documented rather than a
route recommended.

The Kalnins point is the one that survives independently and applies to any
stylised mark that moves: **if the hand is generated per frame, it swims.** Seed
it per *feature*, not per frame.

---

## 4. The locked rules — contracts, not preferences

*A port that breaks one produces exactly the artefact the rule exists to prevent.*

### RULE #0 — NO CHEAT

`ROCK3D-ROTATABLE-STUDY-LOOP.md:9-21`, the top rule, verbatim:

> ## RULE #0 — NO CHEAT. byte-0 IS EARNED BY THE GEOMETRY, NEVER FAKED. (the top rule)
> The object looks like the 2.5D at head-on for ONE reason: **that is how the real
> 3-D geometry actually looks at that angle.** The 2.5D IS the head-on view of the
> real object. Therefore:
> - **RIP OUT the literal-SVG short-circuit.** Do NOT paste the flat 2.5D image in
>   at the head-on frame and swap it for a reconstruction on drag. That is the
>   banned visual trick — a flat card faking the match.
> - The front strokes are the **engine's own captured rendered strokes (post-warp,
>   post-nib) lifted to z=0** — real geometry. Rendering that geometry head-on
>   **reproduces the drawing on its own.** Same strokes the whole way around:
>   rotate and those same strokes **turn away with the geometry** (they do NOT stay
>   face-on) while the **constructed other sides** come into view.
> - **The head-on match is the PROOF the construction is correct.** If rendering
>   the real geometry head-on ≠ the 2.5D, the BUILD is wrong → fix the build,
>   NEVER paper over it with the flat image.
> - **No pop** follows for free — the pop only ever came from swapping the pasted
>   image for a different reconstruction. Kill the swap, the pop dies.

The last clause is why this is a contract. **The pop is not a timing problem to be
tuned away. It is the swap becoming visible.** Any amount of easing on a crossfade
between two representations of the same object will eventually show the seam,
because there is a seam. Delete the swap and there is nothing to hide.

**Free Stroke reached the identical conclusion independently** — `lib/hero-motion.ts:69-74`:

> This used to be called `crossfade`, and the name was the bug. A crossfade is two
> images swapping — the one thing this beat must never read as. There is only ONE
> object here: the same mesh, in the same place, through the same camera, gaining
> depth and gaining light. Nothing appears and nothing disappears, so there is
> nothing to register and nothing to mis-register.

Same law, two codebases, opposite directions. The beat is named `emerge` for
exactly Rock-3D's reason. **This is the strongest evidence the two systems are
compatible** — the target already obeys the source's top rule.

### The five standing requirements

`ROCK3D-ROTATABLE-STUDY-LOOP.md:23-43`:

1. **LINE WEIGHT.** *"never thin, never uniform. CARRY the actual drawn strokes …
   do NOT re-ink a thin uniform line."* Metric `line_weight_match`.
2. **LINES LINE UP.** Carry the drawn depth, do not re-derive it. Metric:
   reproduction IoU → ~1.0.
3. **BAND ON BOTH SIDES (WRAP).** Metric `band_both_sides`.
4. **OG-COMPARE always available** — `?compare=1`, every loop.
5. **EDGE SELECTION — do NOT draw edges the OG's style omits:**

   > The OG (rock3d.js) is a SELECTIVE, sketchy depiction, **NOT a complete
   > geometric edge render.** Our full hidden-line removal draws edges that are
   > *locally geometrically correct* (real crease/depth edges) but that the OG's
   > style **does not draw** — that added geometry … makes it NOT match.

   **A correct renderer of a stylised drawing is a wrong renderer.** The style is
   partly defined by what it omits. This is the deepest of the five and the one
   most likely to bite Free Stroke, whose hero form is a *real* mesh that will
   happily show every edge it has.

### v1 ↔ v2 (historical — see §3.6)

> - **v1 = extrude method = the LOCKED foundation.** Its file is the source of
>   truth; it works standalone. It **guards** the gates + taxonomy + avoid-list.
> - **v2 = revolution … is read-only to v1**: it may NOT edit v1's code path. If
>   v2 needs v1, it calls it. **v2 regressing v1 must be structurally
>   impossible.** v2 is only "better" if it also passes byte-0 + never-flat +
>   no-pop; a v2 that pops or flattens is NOT an improvement over v1.
> — `ROCK3D-ROTATABLE-STUDY-LOOP.md:105-111`

"Regressing the incumbent must be **structurally impossible**, not merely
tested-against" is cheap to adopt: make the new path import the old one rather
than fork it.

### The six gates, and M1–M6

Build gates (`ROCK3D-ROTATABLE-STUDY-LOOP.md:93-103`):

> 1. **byte-0 head-on** — auto pixel-diff = 0 (**moka 0/529200, R 0/346800**),
>    computed by the capture. **Not "it says byte-0."**
> 3. **no banned move** — grep/assert: no faceZ=0 flatten, no crossfade/opacity
>    ghost, no oval-fit, no re-ink, no box-extrusion-walls-called-3D, no re-thrown
>    depth, no flat-SVG rebuild, no inflation, no AI. **Any hit = auto-reject.**

Quality metrics, all six required at every sampled yaw (N=24 at 15°, densifying
to 72 near close):

| # | Metric | Pass condition |
|---|---|---|
| **M1** | Front-face fidelity | at yaw 0 vs the engine's own 2D render: **IoU ≥ 0.995, mean ink Δ ≤ 1/255** |
| **M2** | Stroke completeness | every engine stroke present; per-stroke arc-length coverage **≥ 0.98** |
| **M3** | Solidity / occlusion | **zero** back-face ink visible through the body (impl. `occFrac ≤ 0.08`) |
| **M4** | Never-flat | min silhouette width **≥ 3%** of the long axis, at every yaw incl. ±90° |
| **M5** | Binary visibility | segments with `0 < opacity < 1` must be **0** |
| **M6** | Connected solid | exactly one ink component ≥ 2% of total ink, through the full 360 |

### The calibration rule

The best idea in the corpus, and free:

> **First:** implement M1–M6 as a headless check script over an existing rendered
> object (the shoe). Run it on the current v4 shoe — **it MUST report FAIL**. If
> it reports PASS on the shoe Sebs calls shit, **the check is wrong — fix the
> check first.**
> — `ROTATABLE-SELF-TRAIN-CHECK.md:57`

**And it worked.** `rotatable-v4/proof/shoe/check-report.json` records the
required failure: `M1 iou 0.9314` against a `0.995` threshold, `M6 yawFails 7`,
`M5proxy yawFails 24`. v5 later reports 3 PASS / 3 FAIL — `M2`, `M4`, `M5` green,
`M1 0.66`, `M3 yawFails 1`, `M6 yawFails 5`. **A harness that has published its
own failures is a harness you can believe.**

---

## 5. The hero beat — what ports, and one correction

*The beat itself is documented in
[`14-the-flat-to-solid-beat.md`](../explainers/14-the-flat-to-solid-beat.md) and
[`hero-2d-to-3d-transition.md`](hero-2d-to-3d-transition.md). This section only
asks what Rock-3D can add to it.*

### 5.1 The correction: the letters are centrelines, not outlines

Free Stroke's typed hero letters do **not** come from a font's filled outlines.
They come from `scripts/capture/letters.mjs`, a hand-authored **single-stroke
vector font**, and its header says why:

> WHY SINGLE-STROKE: every polyline becomes a 3D tube/ribbon/volume in Free
> Stroke, so glyphs are built from centrelines rather than outlines. **An outline
> font would give doubled walls with a hollow interior.**
> — `scripts/capture/letters.mjs:1-13`

Glyphs are integer polylines, e.g. `A: { adv: 74, strokes: [L([6,0],[37,-CAP],[68,0]), L([18,-36],[56,-36])] }`
with `CAP 100, XH 52, DESC 30`. `layoutWord()` returns `{polylines, width, height}`;
the page rescales to `FONT_TARGET_W = 1100` and synthesises timestamps at a flat
`MS_PER_POINT = 12`.

**This matters because Rock-3D's Engine A extrudes closed contours.** `rock3d()`
splits by subpath, extrudes subpath 0 as the silhouette, fills an even-odd
occluder, and extrudes the rest as hole rings. An *open* path takes a different
code path entirely — `rock3dStrap` — which is flat by construction:

> Flexible bands are the exception … **No depth — a strap lies flat.**
> — `ROCK3D-ENGINE-COMPLETE.md:121-122`

So feeding `letters.mjs` output straight into Rock-3D yields **no depth at all**.

**The bridge already exists.** `lib/solid-vector.ts` `buildVectorSolid` expands
each centreline by thickness with round caps/joins, unions with
**polygon-clipping**, simplifies, and extracts *"outer boundaries and true
enclosed holes"* → `{ outer, holes }`. That is precisely the
`{silhouette, counters}` shape Engine A wants, produced by the **same library at
the same version** Rock-3D's sweep uses (`polygon-clipping ^0.15.7`, and
`ROCK3D-ENGINE-COMPLETE.md:36` names 0.15.7). `lib/solid-mask.ts` reaches the same
shape by the raster route.

The one missing link is a serialiser, and Free Stroke deliberately dropped it:

> Desk Doodles' `catmullRomPath` … emitted an SVG cubic-Bezier `d` string. **Free
> Stroke has no SVG render path**; its engines consume a point list. So the
> pipeline stages port unchanged and the `d`-string emitter is dropped.
> — `lib/wobble-field.ts:73-77`

**Net:** the port path is `letters.mjs` → `processStroke` → `buildVectorSolid` →
`{outer, holes}` → a `d` string (or, better, a point-list port of `extrudeContour`
that skips SVG entirely) → the throw and occluder. Nothing is blocked; the
sequencing is just longer than "feed it the letters."

### 5.2 Free Stroke has no oblique, and no occlusion

A repo-wide grep for `oblique|isometric|axonometric|faux-3d|2.5d` returns four
hits, all in `stroke-width-models.md` and all in the calligraphic-nib sense. A
grep for `occlusion|occlude|hidden line|painter's algorithm` returns one hit, in a
bundled skill file. **Occlusion in Free Stroke is whatever the GPU depth buffer
does.** There is no silhouette computation, no visibility test, no hidden-line
removal. That is a genuine capability gap, not a stylistic difference — see §6.3.

### 5.3 The trap: do NOT use Engine B for glyphs

The port's most likely wrong turn, because it has the right name. Glyphs in
Rock-3D are **never** run through the extruder:

> running a glyph through `rock3d()` **"TANGLES it,"** so glyphs render **FLAT**
> via `rock3dFlat`. The font already *contains* the 3D; re-extruding it
> double-throws.
> — `ROCK3D-ENGINE-COMPLETE.md:206`

The reason is specific to that font. `glyphs.json` is the **Shibuya Rock 3D**
typeface, whose outlines carry hand-drawn depth baked in as extra subpaths — A has
9, B has 10, D has 11, **R has 16**. Engine B's entire `frontMask` / `depthStrip`
/ coil-kill machinery exists to *strip that baked depth back off*.

Free Stroke's letters have no baked depth — they are centrelines. So Engine B
solves a problem the input does not have, and implementing it would mean building
a skeletoniser, a Delaunay medial axis, a Zhang-Suen fallback and a depth-peel for
nothing. **Engine A is the right target.**

### 5.4 What ports, and what does not

| Ports cleanly | Why it survives |
|---|---|
| The oblique throw, `back = front + tv` | Pure 2D translate. No camera, ~5 lines |
| Swept-silhouette depth, `union(front, front+tv, quads) − front` | Same library, same version, already a dependency. Provably bounded; took clean 59 → 137 |
| The occluder — opaque fill, `fill-rule: evenodd`, in draw order | Four lines; turns a wireframe into a solid |
| Depth bounded by the short axis, `mag ≤ 0.85·sa` | The self-intersection guard. `I` vs `W` is exactly its case |
| Creases at corners only, `0.44` rad, capped by `edgeCap` | One-line guard against scribble |
| "Hand in the geometry, not the stroke" | Corroborated by `handwriting-variability.md` |
| The wonk split, `0.14` objects / `0.06` UI marks | See §5.5 — directly load-bearing |
| RULE #0, M1–M6, the calibration rule | Contracts, not code. Highest value per unit of effort |

| Does not port | Why not |
|---|---|
| The whole rotatable stage | One letter works. Free Stroke's hero already has a real mesh that rotates; a 2.5D→3D reconstructor is a strict downgrade |
| `rockRegionKind`'s eight escape hatches | Each is named for a specific desk object. Take `rockIsWindowFill` + the counter gates; leave the tail |
| `rockGarmentSilhouette`, `rockIsCoil`, `rockStrayIslands`, junction-clip | Multi-part desk objects. A letter is one contour plus counters |
| The `nBodyElements` busy gate | Counts SVG elements. A letter is one path; the gate is a constant |
| `ROCK_CAPTURE` | Its consumer is the rotatable |
| Engine B entirely | §5.3 |
| The Shibuya font | A portfolio identity decision, not a technique |
| `rock3d.js` as a file | 2,269 lines of browser globals, and it early-returns if `window.rough` is absent despite no longer using rough.js's renderer. Port ~120 lines of `extrudeContour` + the occluder |

### 5.5 The finding that matters most for letters

From `OBJECT-STRENGTH-AUDIT.md`, an eye-pass over all 197 objects plus the UI icon
set at the standing wonk of `amp 0.14`:

> **ICONS — the wonk (amp 0.14) is TOO STRONG for functional UI marks:** the
> crispness that makes a mark read instantly as a functional icon is lost —
> **simple geometric glyphs become blobby/melty.** … Direction: icons likely need
> a **lighter wonk** (lower amp, e.g. ~0.05–0.07).

The fix landed at **`amp 0.06`**. Named breaks at 0.14: `iconPlay` "droops to a
pennant," `iconReset` "loop unreadable," `iconDotFilled` renders hollow.

The same audit found a second class — **thin-shaft fragmentation**. Seven objects
(`draftingPen`, `xacto`, `stylus`, `chiselMarker`, `mechanicalPencil`,
`kendoStick`, `cookingTool`) broke apart because the radial warp scales to the
form's *mean radius*, so a long thin straight silhouette got a bow scaled to its
*length*. The fix keys off PCA aspect (`minor/major`), smoothstepping amplitude
from `capFloor 0.22` at aspect ≤ `0.12` to `1.0` at aspect ≥ `0.42`, and
deliberately does not fire on curved thin forms whose curl spreads the minor axis.

**Both land on typed letters.** A hero beat's letters are simple geometric forms
(blobby-melty risk) and several — `I`, `l`, `1`, `t`, the stems of `E`/`F`/`T` —
are long thin straight silhouettes (fragmentation risk). Carry `amp ≈ 0.06` and
the aspect cap, not the object defaults.

One more, from the portfolio's nav work: **Rock 3D was ruled out as a nav logo at
13px — "muddy @13, Sebs confirmed by eye."** The style has a legibility floor.
Irrelevant at hero size; inherited by any small-scale reuse.

### 5.6 Performance — the one that would bite an animation

`liveRockIcon.tsx:612-623`:

> one toggle click re-drew 74 marks = a **3.3-SECOND main-thread block**, and a
> 420ms hover boil cost 137ms of long task.

**~40ms per mark build.** The mitigations, in order of value:

1. **Memoise on a full input key.** *"The engine is DETERMINISTIC: the same
   (markup id · size · rotate · state · boil frame · ink · paper · dial values)
   always yields the same SVG."* LRU-bounded at `SVG_CACHE_MAX = 900`, verified by
   diffing a cached replay against a fresh render.
2. **A frame budget for first draws** — one heavy build per frame, 6 ms slice.
3. **Idle warm-up with no forced timeout.** Their first version passed
   `{timeout: 2000}` and ran on `didTimeout`, which **forced ~40ms builds into busy
   frames** — 18 long tasks / 1540 ms on one mount. *"The warm-up is an
   optimisation; it may only ever spend genuine idle time."*
4. **Geometry pooling** — `<symbol>` + `<use>` plus path decimation took an icon
   page from **22 MB → 0.92 MB**.

**Bake once, animate the baked geometry.** 40 ms is 1.2 frames at 30 fps. Rock-3D's
own "boil" animation only gets away with it by cycling **three** pre-baked frames
on a 140 ms interval — it animates a three-entry cache, not the engine.

### 5.7 The flat↔solid channel is now wired

Worth stating because it changes what a port would attach to. The `emerge` beat's
flat↔solid channel is **live** as of explainer 14 — `FlatState` is exported at
`components/viewport-3d.tsx:483` with `SOLID_STATE` beside it, and
`Viewport3DWrapperProps` accepts the `flatten` prop
(`components/viewport-3d-wrapper.tsx:31`). Read
[`14-the-flat-to-solid-beat.md`](../explainers/14-the-flat-to-solid-beat.md) before
porting anything here: it is the canonical account of the beat, and it settles the
question §4 raises from Rock-3D's side — one mesh driven between two states, not
two layers swapped.

That makes the RULE #0 alignment concrete rather than rhetorical. `FlatState` is a
`{ink, depth, color}` triple the beat interpolates; there is no second
representation to register against a first. **The structural precondition for
Rock-3D's top rule is already satisfied in Free Stroke** — which is why §6.4's
no-morph assertion is worth adding: the property now holds, so it is worth
protecting.

---

## 6. What Free Stroke should adopt — ranked

*Each item: what Rock-3D does, what Free Stroke does instead, what adoption costs,
what it visibly buys.*

### 6.0 First, the shared pathology — a correct classifier that nothing calls

Neither codebase gets to be the model here.

**Rock-3D.** `recognize()` in `rotatable-solid/rock3d-solid.mjs:187-218` classifies
by area fraction, bbox aspect, centroid position and winding. It is imported by
three superseded stages and by nothing live, while the live path runs an SVG-tag
`switch`.

**Free Stroke.** `lib/dd-engine/markIntent.ts` — 889 lines — arc-length resamples,
computes reversal frequency, self-intersections per 100 px, turn-sum and hull
coverage, and classifies into `structure | shading-gesture | fill-intent` via rules
R1–R10 with a `firedRules` receipt on every decision. Its purity contract is
explicit: *"no React, no DOM, no wall-clock, no randomness."* Its thresholds are
labelled provisional and calibrated against a 10-fixture battery.

`analyzeMarkIntent` is imported only by `lib/dd-engine/convert.ts:70`.
**`convert.ts` is imported by nothing.** The live adapter (`lib/dd-engine/adapter.ts:77-98`)
imports raw builders — `buildRodGeometry`, `buildExtrudeGeometry`,
`buildPoolSolidGeometry`, `buildInflateGeometry` — and no classification stage. So:

> **No classification stage is wired into any rendering path in Free Stroke.**

Two projects, same upstream, same outcome. And the mechanism is the same in both:
a classifier improves nothing you can *measure* until something downstream
consumes its output, so it never displaces the incumbent path. Free Stroke's own
audit found the general form of this — fixes recorded as prose beside one call
site while five other call sites never got them.

**The lesson is not "wire up markIntent."** It is that **a stage with no consumer
and no assertion is indistinguishable from a stage that does not exist**, however
well written. Every item below is ranked partly on whether adopting it creates a
consumer for something already on disk.

---

### 6.1 Read the input before rendering it — the biggest structural gap

**What Rock-3D does.** Three separate stages before a single pixel:
`rockSignals(pathD)` → an 8-field scale-invariant vector (`signals.js`);
`rockRegionKind` → `counter | texture | content` with published gates
(`rock3d.js:1767`); `rockChooseParams(features)` → depth, edge cap and three
jitter knobs (`ruleEngine.js:7`). Depth is a *function of the shape*: busy forms
get less, concave forms get more hand-variance, round forms get half.

**What Free Stroke does instead.** Renders whatever it is handed. `adapter.ts`
goes straight from points to builders. Every parameter comes from a UI dial or a
preset; nothing is derived from the mark. The one module that would close this is
dead (§6.0).

**Cost.** Medium, and much lower than it looks, because the pieces exist. Free
Stroke already computes most of Rock-3D's vector: `solid-vector.ts` has the union
and hole extraction, `solid-mask.ts` has coverage and corner detection through the
raster, `markIntent.ts` has arc length, turn-sum, self-intersection and hull
coverage. What is missing is **a signals module the render path actually calls**,
and one consumer that reads it. `signals.js` is 53 lines and ports almost
verbatim; the only change is `resample(pathD, 120)` becoming a resample of a point
list, which `stroke-processing.ts` already does.

**What it buys, visibly.** Parameters that respond to the mark. A dense scribble
and a single clean loop currently get identical treatment at identical dial
settings; with a signals stage they would not. Concretely, Rock-3D's
`concavity = 1 − solidity → depthLenJit` is the exact shape of knob Free Stroke
lacks — `desk-doodles-handfeel-port.md:16-40` names this gap outright:

> Free Stroke already has a width axis and an enormous surface axis. It has never
> had a **path** axis. That is the gap, and it is the top of this list.

A signals stage is what makes a path axis *automatic* rather than another slider.

**One warning.** Copy the discipline, not the tail. Eight of `rockRegionKind`'s
branches are per-object escape hatches. The transferable part is the *shape* —
measure, classify, choose — plus the three or four gates that generalise
(`rockIsWindowFill`, the counter area/solidity test, `rockIsRound`'s
circularity + lobes).

---

### 6.2 A rule layer that says it is provisional

**What Rock-3D does.** `ruleEngine.js:1-3`, in the first three lines of the file:

> Deterministic rules now (rule engine), **the documented foundation for a
> kNN/regressor later** (each {features, params, label} row trains it).

And it means it. Every firing writes `{id, features, params, regime:"rock3d-rules-v1"}`
to `dataset.jsonl` — 197 rows on disk, one per object, with the `regime` field
present precisely so a later regime can be told apart. The architecture doc
repeats the stance as a house rule: *"Rule engine now, trained provider later,
honoring the honesty line (rules today, ML when the data supports it)."*

**What Free Stroke does instead.** Free Stroke is *good* at this in prose and has
no data channel. `markIntent.ts:51-80` labels its constants
`PROVISIONAL per MI-F: calibrated against the 10-fixture battery … log-first
lock-second`, and `11-gloss-rim-and-the-guard.md:253-256` is unusually honest:

> **The ladder's rungs are hand-picked.** `[1.4, 0.9, 0.55, 0.3, 0]` is a
> reasonable geometric-ish descent, **not a derived sequence**.

But the honesty lives in comments. Nothing writes a row. `firedRules` is computed
and discarded.

**Cost.** Very low — an append-only JSONL and a `regime` string. Rock-3D's row is
four keys.

**What it buys.** Two things. First, the ability to answer "is this threshold
right?" with a distribution instead of an opinion — the `pointComplexity` bug
(§2.1) is a feature with zero variance across 197 rows, which one query finds and
no amount of looking at renders does. Second, it gives `markIntent`'s `firedRules`
a consumer, which is the cheapest way to stop it being dead code.

---

### 6.3 Occlusion as an explicit computation

**What Rock-3D does.** Two mechanisms at two levels of sophistication, and the
cheap one carries most of the weight.

The cheap one is the **paper occluder** (`rock3d.js:1229-1241`): an opaque
front-face fill with `fill-rule: evenodd`, drawn between the depth walls and the
front outline. Four lines. It is the entire difference between v1–v8's x-ray
wireframe and a solid block.

The expensive one is the **software z-buffer** (`skeleton-stage.html:395-412`): a
CPU barycentric rasteriser at `RS = 300` keeping minimum z, with visibility tested
**per centreline point**, and visible samples chopped into runs each drawn whole
at full ink. Binary by construction — a sample is in a run or dropped, never
faded. Its predecessor used a sparse point-cloud buffer, read see-through, and
needed a gap-bridging hack to hide the flicker.

**What Free Stroke does instead.** Nothing explicit. One grep hit repo-wide, in a
bundled skill file. Occlusion is the GPU depth buffer.

**Cost.** The occluder is near-free wherever a flat or ink-flattened pass exists —
the `flat = 1` state in the `emerge` beat is exactly that pass. The z-buffer is a
real build, roughly 20 lines of rasteriser plus the run-chopping, and is only
worth it if stylised line output is ever wanted.

**What it buys.** The occluder buys solidity in any flattened state — the
`flat = 1` silhouette that "renders one constant-value silhouette with no shading,
no specular and no rim" (`hero-motion.ts:407-412`) currently has no way to hide
anything behind it, so any depth cue drawn into that state would show through.
The z-buffer buys the option of a stylised-line register at all.

**Take the two rules regardless of whether the code lands:**

- **Binary, never faded.** Metric M5 is "count of segments with `0 < opacity < 1`
  must be 0." A half-visible line reads as a bug in every style.
- **Sample the spine, draw the ribbon.** *"a plain z-buffer FAILS (the stroke's
  triangle-strip interpenetrates the surface → ghosts)"*
  (`ROTATABLE-METHOD-FROM-RESEARCH.md:38`). This is a live hazard for Free Stroke,
  whose marks are all swept tubes and ribbons.

---

### 6.4 A harness whose job is to catch a specific lie

**This is the item to steal outright.** Free Stroke's verification has repeatedly
reported green while measuring nothing; Rock-3D's harness is built the other way
round — it starts from the specific dishonest shortcut it expects and asserts its
absence.

**What Rock-3D does.** Four mechanisms, all small.

**(a) Structure is binary and half the score.** `skeleton-capture.mjs:443-455`
(`no_cheat` at 444, `combined` at 454):
```js
const structure = {
  no_cheat: !/stage\.innerHTML\s*=\s*FRONT\.svgOuter/.test(_html),  // the flat-SVG paste is gone
  details_present: …, band_present: …,
  no_crossfade: !/(crossfade|fadeIn\b|globalAlpha\s*=)/i.test(_html),
  line_weight_match, band_both_sides,
};
const combined = 0.5 * reproduction.score + 0.5 * (structPass ? 1 : 0);
```
Reproduction is a continuous IoU; **structure is all-or-nothing**. One banned-move
grep hit zeroes half the score. Its header states the design intent:

> COMBINED = weighted; **catches the "great pixels, bad structure" cheat** (the
> flat-SVG paste wins reproduction but fails structure). Grades v1 AND v2 the same.
> — `skeleton-capture.mjs:394-397`

**(b) The banned move is checked first.** `one-engine-capture.mjs:177-178`:
```js
// gate 4 first — a banned move means nothing else counts
report.avoidList = grepAvoidList();
```
followed by `report.byte0.genuine = (d0.changedBytes === 0 && d0.sameSize && report.avoidList.pass)`.
**"Genuine" is a computed field**, not a claim: a perfect pixel diff that trips a
grep is not recorded as a pass. Fourteen greps, including
`no_opacity_crossfade`, `no_faceZ_flatten`, `no_oval_ellipse_fit`,
`no_up_left_throw`, `no_rethrow_baked_depth`.

**(c) The anti-gaming test — the cleverest thing in the corpus.**
`rotatable-v4/check-oz.mjs:147-154`:
```js
// anti-gaming: a head-on byte-identical to the engine ref AND discontinuous with yaw-15 = the
// render special-cased rest=engine (a COPY), not the SOLID reproducing it. That's a fake pass.
const iou0_15 = await iou(`${PROOF}/turn-000.png`, `${PROOF}/turn-015.png`);
const m1suspectCopy = (m1 > 0.9995) && (iou0_15 < 0.55);
const m1pass = m1 >= M1_IOU && !m1suspectCopy;
```
**A result that is too perfect, combined with a discontinuity next to it, is
evidence of a special case.** The check is not "is the rest frame right" — it is
"is the rest frame right *for the same reason* the neighbouring frames are."

**(d) The no-morph test — the one Free Stroke should implement this week.**
`one-engine-capture.mjs` measures the per-degree pixel delta of the *first* degree
of motion and compares it to later degrees. Measured on the one-engine moka:

| step | Δ per degree |
|---|---:|
| 0 → 1° | **2.20204** |
| 1 → 2° | 2.21191 |
| 2 → 3° | 2.26671 |
| 3 → 5° | 2.24159 |
| 5 → 8° | 2.24078 |

`firstStepPerDeg 2.20204` vs `laterAvgPerDeg 2.24025` → **pass**. If the first
degree cost noticeably more than the later ones, something discontinuous happens
when motion starts — a swap, a state change, a mode flip.

**What Free Stroke does instead.** The `verify-*` / `assert-*` split is the right
architecture and several asserts are genuinely sharp (`assert-gloss-rim.mjs`
"exits 1 if any contour reverts to the staircase" is exactly this pattern). But
nothing checks for a *specific dishonest shortcut*, and nothing checks continuity
at a beat boundary.

**Cost.** (a) and (b) are a regex list and a boolean — under an hour. (c) needs one
extra frame. (d) needs a handful of frames near the beat start and an arithmetic
comparison.

**What it buys.**

- **(d) applies directly to `emerge`.** The beat's entire correctness claim is
  "nothing appears and nothing disappears" (`hero-motion.ts:69-74`). That claim is
  currently unasserted. Sampling `t` at the first few frames of `emerge` and
  comparing the first inter-frame delta against the later ones **turns the
  doc-comment into a test.** If a swap ever creeps back in — a material change, a
  mesh rebuild, a `decoding` stall — the first delta spikes and the assert fails.
  This is the single highest-value item in this document.
- **(c) generalises to every "byte-identical" claim** Free Stroke makes. Several
  passes assert a default arm is byte-identical to a prior build. That assertion
  cannot distinguish "correct by construction" from "special-cased," and (c) can.
- **(a)/(b) make a banned move impossible to ship green**, which matters most for
  a codebase where several fixes are recorded as prose beside one call site.

**And adopt the calibration rule with it** (§4): a new assertion is run against a
known-bad input *first* and required to fail. Rock-3D's harness has published
failures (`M1 iou 0.9314` against `0.995`; v5 at 3 PASS / 3 FAIL). An assertion
that has never failed has never been tested.

---

### 6.5 Search the number instead of deriving it

**What Rock-3D does.** The home pose and shear are found by search, not by
formula, with the reasoning stated as a rule: *"No assumed throw angles —
measured"* (`skeleton-capture.mjs:159-162`). Three stages, coarse-to-fine, over
`shearFrac × yaw × pitch`.

Two details are the actual lesson.

**The objective is deliberately blurred.** `skeleton-capture.mjs:187`
downscales both frames to 96×96 before differencing:

> raw per-pixel diff gave a FLAT landscape whose minimum was noise (it picked ±6°
> corners over near-identity).

**Match at the scale of the artefact you are chasing.** A per-pixel objective on
hand-inked strokes measures jitter, not layout.

**One axis is pinned, with a reason.** `skeleton-capture.mjs:200, 341` pins
`shearFrac = 1` for the moka because searching it free lets the coarse metric
*"flatten shearFrac→0 to game a hair of IoU, dropping the band."* **A search will
find the cheapest way to satisfy a metric, including deleting a feature the metric
does not measure.**

And the numbers justify it: searched `meanDelta 2.39` vs derived `17.86` vs naive
`7.60` (§3.4). **The closed-form answer was 7.5× worse than the search and worse
than doing nothing.**

**What Free Stroke does instead.** Hard-codes, then hand-tunes. `lieEl: 65`,
`standupAz: 30`, `standupEl: 10`, `holdAz: 38` are authored constants. The
decimation ladder `[1.4, 0.9, 0.55, 0.3, 0]` is admitted hand-picked. Rod's
segment ceiling is "an absolute constant … not derived."

**Cost.** Low per instance. A search over 2–3 parameters against a frame-difference
objective is a script, and Free Stroke already has the capture harness to render
the frames.

**What it buys.** Two named candidates:

- **The decimation ladder.** The doc already knows the principled answer — *"set
  the first epsilon from the loop's own local half-thickness (which the rasteriser
  knows — it is the ink radius)"* — so the search would either confirm the
  hand-picked rungs or produce a derivation. Either outcome closes the item.
- **The stand-up pose.** `standupAz/El` were tuned by eye against "does it read as
  standing." A search against a silhouette-difference objective between the lying
  and standing frames would give the pose that maximises the *read*, which is what
  the beat is for. Bring the pinning lesson: constrain elevation, or the search
  will find a degenerate pose that maximises pixel change and reads as nothing.

---

### 6.6 Bounded constructions over corrective ones

**What Rock-3D does.** Four passes were spent fixing depth over-curve, blobs,
slivers and spikes on 96 of 197 objects with progressively cleverer post-hoc
corrections. What worked was changing the construction to one that *cannot*
produce those defects — a Minkowski sweep clipped to its own bounded region —
*"the depth can NEVER over-curve, sliver, spike past the base, or loop"*
(`rock3d.js:1082-1084`). Clean **59 → 137** in one pass.

**What Free Stroke does instead.** Mixed, and improving. `solid-vector.ts`'s
polygon-clipping union is exactly the bounded kind. The decimation ladder is
exactly the corrective kind — try an epsilon, check, retry — and its own doc says
so. Extrude's overlap handling is explicitly deferred corrective work:
*"Overlapping scribble regions are coplanar overlap, not a real union. Invisible
today; a CSG union is the principled fix if styles ever make it show."*

**Cost.** Case by case; sometimes free (choose the bounded formulation first),
sometimes a rewrite.

**What it buys.** The strongest supporting evidence is Rock-3D's other governing
rule — **"tweaked a number twice and it's still off → the approach is wrong, swap
it"** — with its case study: `recessMag 2.0 → 1.0` failed twice because the
mechanism was wrong, and the fix replaced the mechanism. That is a concrete
stopping rule for parameter fiddling, and Free Stroke has at least one open item
(the ladder) that has already been tuned more than twice.

---

### 6.7 Key off geometry, never off identity — and count the escape hatches

**What Rock-3D does.** Every Stage-1 predicate is a measurement of the shape:
`circularity > 0.80`, `fillRatio ∈ [0.72, 0.83]`, `radialLobes ≤ 2`,
`area / hullArea ≥ 0.7`. Never `if (id === 'sombrero')`, even in the eight
per-object escape hatches — each is *named* for the object that forced it and
*written* in terms of geometry. Stage 2 broke the rule (`<circle>` → lid) and has
one working letter.

**What Free Stroke does instead.** Mostly geometry already — `markIntent`'s
signals are all shape measurements. The `firedRules` receipt is the same instinct
as Rock-3D's per-branch comments, one step better executed.

**Cost.** Zero; it is a review criterion.

**What it buys.** The genuinely portable part is not the rule — it is **the
metric**: *the number of escape hatches is the signal that the feature set is
under-powered.* Rock-3D's classifier needed eight, and that count, more than any
individual gate, is the argument for the learned provider the rule engine says it
is a stand-in for. Free Stroke should count its own.

---

### 6.8 Track severity distribution, not a defect count

**What Rock-3D does.** Pass 8 went 162 clean / 35 defective — *worse* than pass
7's 164/33 — because a line-weight re-anchor made everything sharper and surfaced
residuals the heavy line had been hiding. The summary defends the regression, and
points at the number that mattered: high 15 → 0, med 68 → 0, low 29 → 35. It also
tags 13 of the 35 `taste:true` — *"perceptual / inherent-ceiling … not a fresh
regression"* — so the fixable tail is 22, not 35.

**What Free Stroke does instead.** `diff-frames.mjs` produces reads/faint/too-subtle
verdicts, which is a severity axis, but pass/fail is the reported unit.

**Cost.** Near-zero: a severity field and a `taste` boolean on existing verdicts.

**What it buys.** The ability to ship a change that makes the count worse and the
work better without arguing about it — and the ability to tell "this is at the
ceiling of the technique" apart from "this is broken," which is exactly the
distinction the gloss-rim pass had to make in prose.

---

### 6.9 Two smaller things worth having

**Bake once, animate the bake.** §5.6. Rock-3D animates a three-entry cache, not
the engine, and its per-mark build cost is ~40 ms. If any Rock-3D-derived
construction lands in a Free Stroke beat, it must be pre-baked.

**Better lean than padded.** A recurring ruling in the portfolio's decision
ledger: *"honest count: Rock material ~4 solid characters, not padded to 6."*
Three separate Rock-3D idea maps end with an explicit "honest count < 6" flag
rather than inventing options to fill a grid. The transferable form is: **when a
taxonomy has fewer real members than the template wants, say so in the artefact
rather than padding it** — otherwise the padding is indistinguishable from the
findings.

---

## 7. Still open, and what this doc does not cover

- **`ROCK_CAPTURE` is not rich enough to replace `parseDetails`.** §3.1. It emits
  region kinds, not per-detail rings. Any plan that says "inherit the reading"
  needs the capture extended first, and no document in the corpus says how.
- **Three Rock-3D documents disagree about the rotatable's status.** The material
  idea-map declares the register **DEAD**; the hover idea-map parks two directions
  against it with "do not touch the rotatable code"; the one-engine report shows a
  genuine byte-0 win (`changedBytes 0/529200`, no-morph pass, never-flat 18/18).
  These are not reconciled, and this doc does not reconcile them.
- **The hybrid front-end path is a crossfade, not earned byte-0.**
  `hybrid-stage.html` fades the authored bake out over `[1.5°, 9°]` and measures
  65–75 dB PSNR at φ=0 — not zero changed bytes. It is graded by a different
  script than the RULE-#0 lane and would fail that lane's `no_opacity_crossfade`
  grep. Two "byte-exact" claims in one project, meaning different things.
- **Nothing here was run.** This is a source read plus the projects' own recorded
  measurements. No Rock-3D code was executed, no Free Stroke code was modified,
  and no frames were captured for this document. Every number quoted is one the
  source project measured and recorded, cited to where it recorded it.

---

## Sources

Rock-3D paths relative to
`~/Desktop/Projects/portfolio/portfolio-system-lab/`; Free Stroke paths relative
to the repo root. All read directly.

**The model**
- `docs/system/ROCK3D-DESK-DOODLES-ARCHITECTURE.md` — the reference model; the
  style-vs-unowned-box split; the four-way turnaround taxonomy (§4b)
- `apps/Rock-3D-Lab/ROCK3D-ENGINE-COMPLETE.md` — the three engines, the pipeline,
  the four rotatable lineages, the constant index (stale on round-form depth)
- `apps/Rock-3D-Lab/ROCK3D-SPEC.md` — the construction spec; the HLR correction

**Stage 1**
- `apps/Rock-3D-Lab/signals.js` (53 lines) · `ruleEngine.js` (37 lines) — read whole
- `apps/Rock-3D-Lab/rock3d.js` — `DEF` 7–16 · nib 64–160 · C3 constants 754–763 ·
  `extrudeContour` 1079–1168 · `rock3d()` + occluder 1169–1267 · `rock3dFlat` 1434 ·
  classifiers 1592–1852
- `apps/Rock-3D-Lab/learning/STYLE-FIDELITY-CHECKLIST.md` — invariants, meta-rules
- `apps/Rock-3D-Lab/learning/loopback8-summary.md` — the convergence table
- `apps/Rock-3D-Lab/learning/FLOW.md` · `dataset.jsonl` (197 rows) — the row schema
- `apps/Rock-3D-Lab/OBJECT-STRENGTH-AUDIT.md` — wonk amplitude, thin-shaft cap

**Stage 2 — contracts**
- `apps/Rock-3D-Lab/ROCK3D-ROTATABLE-STUDY-LOOP.md` — RULE #0, the five standing
  requirements, v1↔v2, the six build gates, the avoid-list
- `apps/Rock-3D-Lab/ROTATABLE-SELF-TRAIN-CHECK.md` — M1–M6, the calibration rule
- `apps/Rock-3D-Lab/ROTATABLE-THE-BAR.md` — hard bans, dead ends, the meta-lesson
- `apps/Rock-3D-Lab/ROCK3D-TRUTH-AND-THE-LOOP.md` — the rejected-shortcut list
- `apps/Rock-3D-Lab/ROCK3D-3D-ENGINE-LOOPBACK.md` — the projection-inversion reframe
- `apps/Rock-3D-Lab/ROTATABLE-PROJECTION-GROUND-TRUTH.md` — the inverse-lift table

**Stage 2 — implementation**
- `apps/Rock-3D-Lab/rotatable-solid/skeleton-stage.html` — `buildPart` 242 ·
  dihedral ink gate 267 · magic depths 293–300 · `RS` 547 · `zbuffer` 561 ·
  `FADE_DEG` 584 · spine-sampled visibility 605, 618 · run-chopping 696
- `apps/Rock-3D-Lab/rotatable-solid/skeleton-stage.WORKING-BASELINE.html:389` —
  the literal-SVG short-circuit as it was written
- `apps/Rock-3D-Lab/rotatable-solid/skeleton-capture.mjs` — tombstone 46–49 ·
  `parseDetails` 50–71, still called at 112 · home search 159–240, coarse
  objective 187, pinned axis 200/341 · `HARNESS_SCORECARD` 443–455
- `apps/Rock-3D-Lab/rotatable-solid/one-engine-capture.mjs` — `grepAvoidList` 136–155
- `apps/Rock-3D-Lab/rotatable-solid/rock3d-solid.mjs` — dead `recognize()` 187–218
- `apps/Rock-3D-Lab/rotatable-v4/check-oz.mjs` — M1–M6 checker, anti-gaming 147–154
- `apps/Rock-3D-Lab/rotatable/shell.js` / `shell2.js` — the point-cloud → filled-triangle fix
- `docs/system/DECISION-IMAGES/rock3d-rotatable/**/check-report.json`,
  `one-engine-report.json`, `_report.json` — the published pass and fail numbers
- `smart-layers/staging/Rock3dRotatable.jsonl` — 27 rows; the home-search contrast
- `docs/system/comms/from-fae.md` — the banned-move admission; the v1/v2 dissolution

**Rock-3D decision layer**
- `docs/system/DECISION-IDEA-MAPS/rock3d-{material,face,depth,treatment-idea-map}.md`
- `docs/system/DECISION-IDEA-MAPS/hover-rock3d-object.md` — the measured throw knee
- `docs/system/overnight-research/rock3d-rotatable-method/{v2,v4}-notes.md`,
  `deep-research-raw-result.json` — the method chain, and the refuted VDG claim

**The literature Stage 2 points at** (secondary — cited by the research, not read here)
- Rademacher, *View-Dependent Geometry*, SIGGRAPH '99
- Grimm, implicit generalized cylinders ("worm"), '99
- Kalnins et al., *Coherent Stylized Silhouettes*, SIGGRAPH '03
- Appel / Cole et al., filled-triangle z-buffer hidden-line removal

**Free Stroke, for the port surface and §6**
- `lib/hero-motion.ts` — the eight beats; the `emerge`-not-`crossfade` note (69–74)
- `docs/explainers/14-the-flat-to-solid-beat.md` + `research/hero-2d-to-3d-transition.md`
  — the beat this doc's §4 and §5 attach to; one mesh, two dials, nothing swapped
- `components/viewport-3d.tsx:483` — `FlatState` / `SOLID_STATE`, the live channel
- `scripts/capture/letters.mjs` — the single-stroke centreline font (1–13)
- `lib/solid-vector.ts` — centreline → `{outer, holes}` via polygon-clipping
- `lib/dd-engine/markIntent.ts` (889 lines) · `convert.ts` · `adapter.ts` — the
  classifier, its only importer, and the live path that skips both
- `lib/wobble-field.ts:73-77` — why there is no SVG path
- `docs/explainers/11-gloss-rim-and-the-guard.md:242-256` — hand-picked rungs, no bevel
- `docs/research/desk-doodles-handfeel-port.md:16-40` — the missing path axis
- `docs/research/extrude-solid-quality.md` — the existing desk-doodles port

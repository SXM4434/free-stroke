# Desk Doodles hand-feel → Free Stroke: what to port, in order

Written after reading Desk Doodles' hand-feel and 3D-conversion source and its
`docs/` tree end to end, against the complaint that Free Stroke's Inflate render
of "Desk Doodles" *"doesn't look like handwriting, it looks like some stupid
machine wrote it."*

Source repo: `~/Desktop/Projects/desk-doodles` (canonical clone; ignore
`.claude/worktrees/`). Every file:line below is in that tree unless it starts
with `lib/`, `app/` or `components/`, which are Free Stroke.

---

## 0. The finding, before the list

**It reads machine-made because it is machine-made, and the machine is upstream
of the geometry.**

The hero word comes out of `scripts/capture/letters.mjs`, a single-stroke vector
font built from exact primitives — `A: { adv: 74, strokes: [L([6, 0], [37, -CAP], [68, 0]), …] }`,
three integer points; `arc()` sampling a mathematically perfect circle. That
polyline then goes through `lib/stroke-processing.ts`, which arc-length
resamples it onto an even grid and Taubin-smooths it. Both stages make the path
*more* exact. Then a tube of near-constant radius is swept along it.

There is no stage anywhere in Free Stroke that puts a hand back. Before this
work, a grep for `wobble|jitter|seededRandom|handFeel|hand-feel` across `lib/`,
`components/`, `app/` and `scripts/` returned **nothing** except shader dot-jitter
in `dither-shader.ts` / `texture-shader.ts` and some prose about squash in
`hero-motion.ts`. Not one line of the mark-character machinery exists here.

Desk Doodles' whole hand-feel system is that missing stage, and it is governed
by a locked invariant that says exactly which axis it owns —
`docs/locked-refs/F3-smart-hachure-system/09-LOCKED-MODEL.md`, **I-11**:

> **Wobble = path/motion master.** […] Wobble defines WHERE the stroke's path
> goes in 2D space. Geometric path waviness — the trajectory wanders. […]
> **Roughness does NOT move the path — only wobble does that.**

Free Stroke already has a width axis and an enormous surface axis. It has never
had a **path** axis. That is the gap, and it is the top of this list.

Two of their doctrine lines are worth keeping in view while reading the rest:

> **Seeded wobble is authored; unseeded wobble is noise.**
> — `docs/knowledge/09-systems-thinking.md:82`

> an engineering choice that's […] **"premium but lifeless" (perfectly uniform
> output with no hand in it) — gets killed.**
> — same file, `:84`

The `physics-intuition` skill states the same thing from the animation side:
*"Arcs — Gravity curves everything. […] **Straight lines feel robotic.**"*

### What Desk Doodles does NOT claim

Being honest about the reference: **their docs do not treat two of the three
things in the complaint as defects at all.**

- **Constant-radius tubes.** No doc names this as a bug. Rod is constant-radius
  *by design* — `docs/knowledge/07-the-3d-pipeline.md:24` calls the result
  *"a **worm/wire** version of your line."* Pressure→radius on Rod is listed as
  an unshipped stretch (`docs/design/3d-mode-controls-spec.md:35`). The only
  place variable radius ships is Inflate, described as *"the one sanctioned
  place the hand survives into the volume"* (`docs/knowledge/13-the-3d-system.md:35`).
- **Spherical joints.** Documented as **intended features with tuning knobs**:
  *"**Joint blobs** (spheres filling the pinch crease at sharp corners), **Joint
  sensitivity** (the corner angle that earns a blob)"* — `13-the-3d-system.md:33`.
  Sibling spheres rather than CSG union is a deliberate implementation choice
  (*"simpler than CSG merge"*, `3d-roundtrip-build-plan.md:48`). Their own
  Tier-2 backlog reserves `joint treatment (blob / clean miter)` for a future
  taste pass — so a cleaner joint is on their wishlist too, unbuilt.
- **Crossings.** Explicitly **cut**, and defended:
  > **Cut: crossing strokes do NOT subdivide regions this makeathon.** […]
  > **Teddy treats a stroke drawn across the object as an explicit cutting
  > OPERATION, never a passive split**; […] **nobody infers sub-regions
  > silently from crossings.**
  > — `docs/design/conversion-semantics-addendum.md:41-43`

  Their parked fix is the same one Free Stroke is already building:
  *"Implicit/metaball/SDF field + **Marching Cubes** […] **fields just add, so
  merges/self-intersections resolve naturally**"* (`KNOWN-SOLUTIONS-PART2.md:128`).

So porting Desk Doodles wholesale does **not** fix the tubes, the joints or the
crossings — Free Stroke is at or ahead of them on all three. What Desk Doodles
has that Free Stroke does not is **the hand in the line**.

---

## The port list, ranked by visible impact

### 1. The arc-length wobble field — **PORTED AND SHIPPED**

*Impact on the machine-made read: the largest single item. This is the axis
Free Stroke did not have.*

**What Desk Doodles does.** A seeded 1-D value-noise field, cosine-interpolated,
sampled by **cumulative arc length**, displacing the path's **anchors**.
`SvgStyleTransform.tsx:693-725`:

> ```
> /** Generate a smooth low-frequency 1D wobble field along arc length.
>  *  Returns a function (t: 0..1) → [dx, dy] that produces ~1 oscillation per
>  *  `wavelengthPx` of path length. Used to add flowing wobble to a Catmull-Rom
>  *  curve without per-anchor micro-jitter. */
> ```

Applied at `:854-856`, and the *why* is the load-bearing part:

> ```
>   // Apply wobble field to each anchor before generating Catmull-Rom curve.
>   // (Displacing the anchors themselves produces a curve that wobbles WITH the
>   // path direction. Jittering only control points doesn't move the curve.)
> ```

**The non-obvious half — why the naive version fails.** They already paid for
this. `SvgStyleTransform.tsx:1695-1707`:

> ```
>       // RDP INPUT NORMALIZATION (2026-06-09): drawn freehand and uploaded
>       // auto-traced SVGs come in DENSE (heart ≈80 verts / 502px, rose sub-path
>       // ≈25 verts / 200px). The wobble pipeline was calibrated against audit
>       // shapes which are SPARSE (2-6 verts per path). Dense input through the
>       // same wobble produces braid character (wavelength ≈ vertex spacing).
>       // […]
>       // EPSILON 1.5 → 3.0 (2026-06-09 follow-up): heart curves at ε=1.5 still
>       // produced ~30-40 anchors → braid. Bumped to 3.0 → ~15-20 anchors →
>       // flowing.
> ```

Per-point jitter has a wavelength equal to the point spacing, so a densely
sampled stroke turns into a hairy rope. **This matters acutely in Free Stroke**,
whose `processStroke` resamples at spacing 4 — precisely the dense regime that
braids. A wobble added without the RDP stage in front would have reproduced
their failure exactly.

**What Free Stroke did instead.** Nothing. Exact font path → smoothing → tube.

**Ported as:** `lib/hand-feel.ts` and `lib/wobble-field.ts` (new files; the
maths, the constants and the explanatory comments come across verbatim, with a
provenance header naming the source line ranges and every deviation). Wired
through `lib/stroke-processing.ts` as an additive argument, **defaulting off**,
and turned on at `app/desk-doodles/page.tsx` with a Wobble dial and an endpoint
pill row.

**The one thing that did NOT port verbatim, and why.** Amplitude. Their
`rough-handdrawn` preset pairs `wobble: 0.4` with `strokeWidth: 1.2`, giving a
1.12px excursion on a 1.2px line — the wobble is about **as wide as the line
carrying it**. Free Stroke's Inflate ink is **22.58px** in the same coordinate
space (measured live off the page, not estimated:
`computeSolidEffectiveThicknessPx(DEFAULT_SOLID_PARAMS.thickness)`), so ported
as a raw pixel value the wobble is measurably present and **visually
invisible** — captured frames at wobble 0, 0.4, 0.8 and 1.2 were near-identical.
Scaling by the full ink ratio (18.8×) went the other way and blew the
letterforms apart into an unreadable tangle. The shipped conversion is the
**geometric mean**, `sqrt(inkWidth / 1.2)` ≈ 4.3× at our weight, which lands the
wander at ~21% of the mark's own width — visible as line character, nowhere near
legibility. That is a documented compromise, not a ported constant — and it is
Desk Doodles' own porting rule applied in the direction they wrote it for
(`strokeTo3d.ts:116-122`):

> **All ABSOLUTE world lengths convert ×8/3; radius-RELATIVE factors port verbatim.**

**Result (judged, not asserted):** at the shipped default the word stays fully
legible while the strokes visibly wander; the two `o`s in "Doodles" and the two
`l`s stop being identical to each other, which is the property that separates
handwriting from a font.

---

### 2. Per-stroke seeds, so the same letter differs twice — **PORTED AND SHIPPED**

*Impact: high, and cheap. Without it, wobble makes a font that wobbles
identically — still a font.*

**What Desk Doodles does.** Seeds by position in the SVG tree —
`100 + idx * 13` per top-level child (`SvgStyleTransform.tsx:2099`),
`seed + idx * 17` per group child (`:2053`), `seed + subIdx * 31` per sub-path
(`:1894`), with coprime layer increments (`SEED_INCREMENTS`, `:218-224`).
Determinism is invariant **I-7**: *"All randomness derives from a deterministic
seed; no `Math.random()` outside the seeded RNG."*

**What Free Stroke does instead.** `processStroke` is called one stroke at a
time with **no index** (`app/page.tsx:198`, `app/desk-doodles/page.tsx:264`), so
their index-multiplication scheme has nothing to multiply.

**Ported as:** `deriveStrokeSeed` in `lib/wobble-field.ts` — FNV-1a over the
stroke's own quantised endpoints, midpoint and length. Deterministic (so the
capture/verify frame-diff pipeline still works) and different per stroke,
because two instances of the same glyph sit at different coordinates. This part
is explicitly marked in-file as **not** a port.

---

### 3. Endpoint overshoot — **PORTED AND SHIPPED (default `protrude`, dial exposed)**

*Impact: medium-high on letterforms specifically. A hand does not stop exactly
on the mark.*

`SvgStyleTransform.tsx:727-768`, verbatim, including the three magnitudes
(4px protrude / 9px long-overshoot / 2.5px kink) and the rule that `kink`
pushes **every** anchor at a random angle rather than extending the two ends.
Their post-lock ruling R-1 (`09-LOCKED-MODEL.md:393`) is the record of why
`kink` survived a proposed cut: it is a genuinely different geometry class.

**Caveat found by capture, worth stating loudly:** scaling this by ink weight is
wrong. Doing so threw ~22px tails off every stroke end and destroyed the word.
Desk Doodles scales protrude by **shape size** (`f3HandFeel.ts` `protrudeScale`),
never by ink weight, and that distinction is now honoured.

---

### 4. Corner-preserving smoothing before the wobble — **PORTED AND SHIPPED**

*Impact: medium. It is what makes wobble read as deliberate rather than noisy.*

`smoothPolyline`, `SvgStyleTransform.tsx:654-691`. Runs a 3-point average only
where the local turn is under 30°, so genuine corners survive. Desk Doodles'
ordering comment (`:833-835`) is the point:

> ```
>   // 1) Corner-preserving smoothing: remove input micro-jitter at gentle-curve
>   //    segments so wobble=0 reads clean. Sharp corners (rectangles, V-bottoms)
>   //    bypass smoothing entirely so they stay sharp.
> ```

Kill the capture tremor **first**, then lay a deliberate seeded wobble on top.
Doing it the other way round smooths the wobble straight back out. Free Stroke's
existing Taubin pass does the tremor removal, so the ported pass runs after it
and before the final re-resample.

---

### 5. RDP with the degenerate-chord guard — **PORTED AND SHIPPED**

*Impact: invisible on its own; a prerequisite for #1 (see the braid quote), plus
one real latent bug fix.*

Taken from `strokeTo3d.ts:344-391` rather than the older copy inside
`SvgStyleTransform.tsx`, because only the `strokeTo3d` copy carries their BUG 2
fix — a closed loop whose endpoints coincide has a ~0-length chord, the
perpendicular-distance formula divides by ~0, and *"RDP collapses the whole
symmetric loop to just [first, last]"*, radius-dependently, so *"it looks
non-deterministic."* Free Stroke feeds closed loops (`closedO`, `nearTouch` in
the geometry baseline) straight in, so this guard is load-bearing here.

---

### 6. Variable stroke width — **ALREADY DONE BY ANOTHER AGENT; DO NOT DUPLICATE**

*Impact: high — and it is already landed.*

The brief named this as the likely top item. It is already ported into
`lib/geometry-engines.ts` (lines ~4353-4526) by the agent rebuilding Inflate
fusion: `INFLATE_TIP_FRACTION`, `INFLATE_PROFILE_EXP = 0.8`,
`INFLATE_PRESSURE_INFLUENCE = 0.35`, `inflateSynthPressures`, and the
flat-channel guard. Their header even carries the same "why ours read as pipe"
analysis. **That file is off-limits and the work is done; nothing here touches it.**

**On the specific trap the brief asked me to check — does Free Stroke's
flat-channel guard actually fire?** Yes, on both surfaces, by two different
routes:

| surface | pressure written | guard path |
|---|---|---|
| `/desk-doodles` (hero) | none at all — `timeStrokes` builds `{x, y}` only (`app/desk-doodles/page.tsx:107-126`) | `inflateResampleScalar` returns `null` → `pressures` null → curvature synth fires |
| `/` (lab) | **constant `0.6`** — `app/page.tsx:190` `{ x, y, t, pressure: 0.6 }` | flat channel, `max − min = 0 ≤ 0.02` → treated as no channel → curvature synth fires |

The second is exactly the trap Desk Doodles documents — a `?? fallback` gate
would have been silently defeated by that constant. The ported `> 0.02` variance
test catches it. Free Stroke's live drawing canvas (`components/drawing-canvas.tsx:279`)
does write real `e.pressure`, which for a mouse is a constant `0.5` — also
caught.

---

### 7. Direction-dependent width (the broad-nib model) — **NOT IN DESK DOODLES; RECOMMENDED**

*Impact: potentially the largest remaining item, and it is genuinely new work.*

Desk Doodles has no nib model, so there is nothing to port — this is a gap in
**both** codebases. It is called out here because much of what reads as
"handwriting" in a monoline source is **thick-thin driven by stroke direction**
against a fixed nib angle, and neither app has any of it. Their own artist canon
gestures at the same thing from the drawing side
(`01-agent-research-artist-tonal-canon.md:65`):

> **Line-weight transition at the boundary**: thicker on shadow side, thinner on
> lit side […] **Outline is not constant — it tapers.**

Free Stroke can land this **without touching `lib/geometry-engines.ts`**, because
the pressure channel is already plumbed end to end and the already-ported
flat-channel guard prefers a *real varying* channel over its own curvature
synth. Writing a nib-derived width into `Point.pressure` in
`lib/stroke-processing.ts` therefore drives the existing width profile for free.
See [`docs/research/stroke-width-models.md`](stroke-width-models.md) for the
technique and constants. **Note, from that doc:** the `Point.pressure` route
proposed in the paragraph above tops out at a **2.077 : 1** contrast ratio, well
below any broad-nib hand — it is a prototype route, not the shipping one.

---

### 8. Multi-stroke layering — **NOT WORTH PORTING AS-IS**

Desk Doodles layers the same path 2-8× with per-layer seeds and offsets
(`multiStrokeMeta`, `:93-106`; `stableLayerNudge`, `:226-285`). It is a
significant part of their hand-feel, and it is **2D-only by nature**: the effect
is overlapping semi-transparent ink lines. In 3D each layer would become another
solid tube, and Inflate would fuse them into one fatter blob — the character
would be destroyed by the very fusion that makes Inflate work. Their own
`stableLayerNudge` header block is also stale relative to its code (documents a
0.6-4px range, implements 3.5-14px), so it is not a clean thing to lift.

Skip. If a "drawn twice" read is ever wanted in 3D it needs its own design, not
this port.

---

### 9. Pen-tip presets (perfect-freehand) — **NOT PORTABLE AS-IS**

`PEN_TIP_PRESETS` (`handFeel.ts:477-487`) is a good table — 8 tips with
thinning, taper and pressure-jitter values. But it drives `getStroke`, which
emits a **filled 2D polygon outline**, and Free Stroke has no SVG render path
and no `perfect-freehand` dependency. The *table* is worth keeping as calibration
data for a future width model; the machinery is not portable.

Worth recording that Desk Doodles knows it loses this too — the same trade,
stated in `docs/knowledge/02-pipeline-of-a-doodle.md:25,128`:

> **`strokeToPolygonPath` (filled, variable-width) is what your hand *looks
> like*; `strokeToPolylinePath` (centerline, uniform) is what the pipeline *can
> transform*.** […] The cost (losing pressure-width character) is a known,
> commented trade.

---

### 10. Joint spheres and crossing fusion — **NOT A PORT; FREE STROKE IS AHEAD**

Both named in the complaint, neither improved by porting Desk Doodles (see §0).
Free Stroke's implicit-field Inflate fusion is the fix Desk Doodles has parked
in its own backlog. Leave to the agent working in
`lib/implicit-surface.ts` / `lib/geometry-engines.ts`.

The one portable idea, if joints stay visible: Desk Doodles' joint dedup is
tighter than Free Stroke's — `JOINT_DEDUP_FACTOR = 0.75 × radius`
(`strokeTo3d.ts:152`) vs Free Stroke's `TUBE_RADIUS * 1.8`
(`geometry-engines.ts:869`). Theirs places *more* joint spheres, not fewer, so
this is a taste lever rather than a fix, and it lives in a file that is off-limits.

---

---

## The finding the measurement handed over: the pen is enormous

Worth separating from the port, because it is not a Desk Doodles issue and no
amount of hand-feel fixes it.

The hero ink is **22.58px** wide in a coordinate space where the traced logo is
1100 × 242 and a capital is roughly 110-130px tall. **The stroke is about a
fifth of the cap height.** Desk Doodles' reference line is 1.2px against
~100px shapes — about 1%. Ours is ~20×that ratio.

At that weight the mark is not a pen, it is a fat marker, and a fat marker
swept in 3D is *exactly* what "extruded pipe" describes. It is also why the
wobble had to be scaled up 4.3× before it could be seen at all, and why the
counter-pressure from legibility showed up so fast: there is very little room
between "invisible inside the tube" and "wider than the letter's own strokes".

This is a **dial, not a bug** — `SolidParams.thickness`, which `/desk-doodles`
never overrides, so it renders at `SOLID_THICKNESS_SLIDER_DEFAULT`. But it is
the cheapest single change available to the "machine-made" read, it costs
nothing to try, and it would make every other hand-feel lever work harder. It
needs Sebs's eye rather than a unilateral change, so it is flagged here rather
than altered.

---

## Verification

- **Frames.** `scripts/verify/verify-handfeel.mjs` drives the live Wobble dial
  on `/desk-doodles` (which runs Inflate by default — `lib/registers.ts:252`)
  and captures a 5-pose orbit plus a tight crop at each setting. Headed Chrome
  with `--use-angle=metal`, per the standing rule. Output:
  `docs/verification/handfeel/`.
- **Baseline.** `scripts/verify/geometry-baseline.mjs` before and after. Because
  hand-feel defaults to **off**, the baseline is expected to be unchanged —
  that is the point of the default, not an accident.
- **Two capture bugs worth remembering.** Playwright evaluates a *string*
  argument as a bare expression and never binds the args, so a stringified arrow
  silently never runs — this reported "dial not found" twice while the dial was
  present. And the harness hooks mount before the sidebar does, so waiting on
  `__captureHarness` is not enough; wait on the control itself.

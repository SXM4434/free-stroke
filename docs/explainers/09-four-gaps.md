# Explainer 09 — Four gaps: a control that couldn't speak, and three surfaces that lied

Four defects carried on the "still weak" list at the end of the engine passes.
Three are surface-quality bugs with a real, measurable cause; one is not a
rendering bug at all — it is a control that was working correctly and had no way
to say so.

Files: `components/viewport-3d.tsx`, `lib/geometry-engines.ts`, `lib/solid-mask.ts`,
`lib/ascii-shader.ts`, and four new capture scripts under `scripts/verify/`.

Evidence: `docs/verification/{timing-note,rod-adaptive,solid-rim,marquee-bulbs}/`
and the geometry net at `docs/verification/geometry/{before-gaps,after-gaps}/`.

---

## 1. Natural vs Authentic — the control was fine, the panel was silent

### What was actually wrong

Nothing in the renderer. Natural and Authentic are the same code path with one
number changed:

```
Authentic : distance = penTimeDistanceFraction(strokes, t)
Natural   : distance = penDistance + (t - penDistance) * hybridBlend
```

The *only* thing separating them is how far `penTimeDistanceFraction` departs
from the playhead itself. If the pen moved at constant speed, `penDistance(t) == t`
and the two settings are byte-identical renders. The toggle then looks broken —
because there is nothing in the input for it to express.

**Where the divergence really lives.** The brief pointed at
`lib/stroke-processing.ts`; it isn't there, and it is worth saying why. Stroke
processing has exactly one job in this story: `resampleStroke` linearly
interpolates `t` (and `pressure`) as it walks the polyline, so the pen's timing
*survives* arc-length resampling. It creates no divergence and destroys none.
The divergence is entirely in the reveal, in `components/viewport-3d.tsx` —
`penTimeDistanceFraction` for Solid/Extrude/Inflate and the `timeFracs`/`distFracs`
table for Rod.

### The fix: measure the live strokes, then say what you measured

`measureTimingCharacter` samples the reveal across its middle using **the same
function the reveal uses**, and takes the largest gap between the pen's actual
distance and constant speed, as a fraction of total stroke length:

```ts
const TIMING_CHARACTER_THRESHOLD = 0.01   // below this, < 1px on screen

for (let i = 1; i < 24; i++) {
  const u = i / 24
  const d = penTimeDistanceFraction(strokes, u)
  if (d === null) return none              // no usable timestamps at all
  maxDeviation = Math.max(maxDeviation, Math.abs(d - u))
}
```

Endpoints are skipped: both curves are pinned to 0 and 1 there.

Because the note is generated from that number, it cannot describe something the
renderer isn't doing. Two surfaces in the real panel:

- a **live chip** beside the toggle — `±16.4%`, `±3.3%`, `±0.0%`, or `no timing`
- an **inline note** under the transport bar, which switches branch on the
  measurement rather than reciting boilerplate

The three branches:

| Live state | What the note says |
|---|---|
| no usable timestamps | "both settings render the same reveal" |
| deviation < 1% | "made at a near-constant speed (max departure X%), so both settings render the same reveal — strokes imported from the letter font are stamped at a fixed interval per point and have nothing to replay. Draw by hand, with pauses and flicks, to hear the difference." |
| deviation ≥ 1% | "pen speed departs from constant by up to X% of its length, so the two settings differ" |

It also states the limit honestly: *"Speed only: pen pressure is recorded but no
engine reads it yet."* `Point.pressure` is captured by the drawing canvas and
carried through processing, and no reveal or geometry path consumes it.

### The verification bug this uncovered — worth more than the feature

`scripts/verify/verify-timing-note.mjs` does not screenshot the note and call it
done. It reads the note from the real DOM, renders the draw-in twice, and
**fails the run** if the prose disagrees with the frames.

The first version of that script reported a Natural-vs-Authentic frame
difference of **exactly 0.000 on every case** — which would have "proved" the
note was lying. It was the test that was broken, in two ways at once:

1. `page.click("text=Natural")` matches the note's own prose as well as the
   button — the click landed on a `<span>` and changed nothing.
2. The click ran while DEV capture mode was on. Capture mode takes the viewport
   out of flow at a fixed 1920×1080, which pushes the **Authentic button past
   the right edge of a 1600px window**, where Playwright can never click it:

```
AFTER capture enable:
  Natural   x=1574  (window is 1600 wide)
  Authentic x=1626  ← outside the viewport
page.click('text=Authentic') -> TimeoutError
```

Both series were rendered on Natural. This is precisely the failure the house
rule exists for — *a harness that passes while the interface is unreachable.*
The script now flips the mode with a real mouse click on the real button with
capture mode **off**, then **reads the button's pressed state back and throws if
it did not move**, before a single frame is captured. It also reloads the page
per case, because turning capture mode off does not restore the control bar's
laid-out width in the same tick and later panel shots came back cropped.

A third case was added — `constSpeed`, points laid out at equal *arc length* with
a fixed ms per point — so the "no character" branch of the note is tested too,
not just the "they differ" branch.

### Measured

| Case | Note's claim | Worst frame Δ | Verdict |
|---|---|---|---|
| `constSpeed` (equal arc length, fixed ms) | ±0.0%, "same reveal" | **0.000** | agree |
| `fontLike` (fixed ms per point) | ±3.3%, "differ" | **8.197** | agree |
| `handDrawn` (real pointer events, with a dwell) | ±16.4%, "differ" | **17.322** | agree |

The measured percentage tracks the rendered difference monotonically. Frames at
`docs/verification/timing-note/`; the three `*_panel.png` shots are the real
panel, photographed out of the page.

An honest note on `fontLike`: a stroke stamped at a fixed ms per point is *not*
necessarily constant-speed. Points sampled uniformly in a curve parameter sit at
unequal arc lengths, so the pen covers more distance per tick on the flat parts —
hence 3.3%, and hence a visible difference. Constant *speed* requires equal arc
length per tick, which is what `constSpeed` builds. The note reports what is
actually in the strokes rather than what their provenance suggests.

---

## 2. Rod — curvature-adaptive tube sampling

### What was actually wrong

Rod segmented the tube uniformly:

```
tubularSegments = clamp(points.length * 3, 8, 512)
```

One count for the whole stroke, spread evenly along it. Both ends of that trade
are visible: long strokes spend tens of thousands of triangles on straightaways
where two rings would do, and tight curls get the same ring spacing as the
straights and read as a chain of flat chamfers.

### The math: where to put a ring

Approximate the local shape by its osculating circle of curvature `k` (radius
`1/k`). A chord spanning arc length `ds` across that circle departs from the true
curve by a sagitta of

```
h = (1/k) · (1 − cos(k·ds/2))  ≈  k·ds² / 8        (small k·ds)
```

Require `h ≤ ε` and solve for the spacing:

```
ds ≤ √(8ε/k)     ⟹     d(s) = 1/ds = √( k(s) / (8ε) )
```

So ring density grows as the **square root** of curvature: a curve ten times
tighter gets ~3.2× the rings, not 10×. `ε` is expressed as a fraction of the tube
radius (`TUBE_FACET_TOLERANCE = 0.02`), because that is the scale at which a
facet reads — a flat spot 2% of the radius deep is invisible, one 20% deep is a
chamfer.

`k(s)` is measured discretely off a dense arc-length resample: the turn angle
between consecutive chords divided by the mean chord length — literally *turn
angle per unit arc length*.

```ts
a = (p[i]   − p[i−1]) / |…|
b = (p[i+1] − p[i])   / |…|
turn = acos(clamp(a·b, −1, 1))
k    = turn / (0.5 · (segLen[i−1] + segLen[i]))     // rad per world unit
```

### Floor and ceiling

- **Floor** — `TUBE_DENSITY_FLOOR = 0.3` of the density the uniform rule would
  have used. A straight run still carries enough rings to bend with the stroke
  and to give the draw-in reveal somewhere to stop.
- **Ceiling** — `TUBE_MAX_RINGS_PER_RADIUS = 2`, i.e. one ring per half tube
  radius, and **absolute, not relative**. Finer is invisible anyway: the
  cross-section is only `RADIAL_SEGMENTS = 16` sided, so ~22° of radial facet is
  the floor on visible smoothness. It has to be absolute because the uniform
  rule's density is `min(3·points, 512) / length`, which *shrinks* as a stroke
  gets longer — a ceiling defined relative to it would starve exactly the case
  that needs help: a long stroke that has hit the 512 cap and contains one tight
  curl.

### Placement

Integrate the clamped density along the stroke to get a cumulative "ring budget",
then place ring *j* where the budget reaches `j/N` of its total — equal curvature
budget per ring rather than equal arc length. Total count is `round(total)`,
clamped to `[8, 512]`.

### Making three.js emit non-uniform rings

`THREE.TubeGeometry` samples its path with `getPointAt(i / tubularSegments)` and
frames it with `getTangentAt` — both arc-length parameterised. Rather than
hand-rolling a loft, `ArcWarpedCurve` wraps the curve and overrides those two to
consult a piecewise-linear warp, **bypassing `Curve`'s own arc-length remap**
(which would re-normalise speed and cancel exactly the non-uniformity we want).
Positions, normals, UVs and the index buffer still come from three.js.

### The reveal had to learn about it

Rod's rings are no longer evenly spaced, so the draw-in can't assume ring *j*
sits at `j / tubularSegments`. `StrokeMeshData` now carries `ringArcFracs`, and
the reveal binary-searches it for the pen's distance. The old
`floor(tParam * tubularSegments)` was already subtly wrong even for uniform
rings — `tParam` is a raw curve parameter while ring placement is an arc-length
fraction, and centripetal Catmull-Rom makes those disagree by several percent
through curvature. The ring table removes the mismatch entirely.

### Measured

`ROD_TUNING.adaptive` is a DEV A/B switch that restores the old rule exactly, so
`scripts/verify/verify-rod-segments.mjs` captures before and after from one
build — same stroke, same camera, same lighting, one variable.

| Shape | Uniform tris | Adaptive tris | Δ |
|---|---|---|---|
| `hairpin` (two straight runs + a 180° turn) | 33,240 | 22,360 | **−33%** |
| `loopyS` (the everyday case) | 29,432 | 17,976 | **−39%** |
| `spiral` | 59,784 | 52,040 | −13% |
| `tightSpiral` (6,700px of arc, hits the 512 cap) | 110,968 | 110,968 | **0%** |

Bounding boxes are identical to 3 decimal places on every shape.

`tightSpiral` is the important row. The count does not move — both runs spend the
same 512 rings — but the *placement* does, and that is where the faceting was.
Under the uniform rule the innermost coil (8px radius, ~50px circumference) got
about four cross-sections: a visible polygon, not a curve. Compare
`rod-adaptive/uniform/tightSpiral_close_008.png` against
`rod-adaptive/adaptive/tightSpiral_close_008.png` — same triangle budget, chain
of flat chamfers versus a smooth curve.

`hairpin` is the other half of the trade: the close-ups are visually
indistinguishable, and adaptive gets there with a third fewer triangles.

---

## 3. Solid rim striping — diagnosed from the geometry, not guessed

### What was actually wrong

Not shading, not UVs, not lighting. The rim was built as **independent quads** —
four fresh vertices per contour segment — so `computeVertexNormals()` had nothing
to average and handed every quad a flat face normal.

The live probe (`__geomDebug.probeNormals`, captured to
`docs/verification/solid-rim/before/probe.json`) on a long smooth arc:

```
uniquePositions        306
rimVerts               612          ← 2 per contour point, unshared
rimSplitGroups         306 of 306   ← every point's normals split
meanRimSplitDeg        25.15
rimTurnAlternationRatio 0.834
rimTurnSample          … −39.941, +39.941, −39.941, +39.941, −39.941 …
```

That last line is the whole diagnosis. The split is **not** the contour turning —
it is quantisation noise with a textbook alternating signature. The outline is
traced off a 512px lattice, Chaikin-smoothed, then Douglas-Peucker decimated at
0.45px, so retained vertices sit up to about half a pixel either side of the true
curve. The contour zig-zags left–right by half a pixel every segment.

Half a pixel is geometrically nothing — about 0.1% of the form's width. But
**per-face normals render it at full contrast**: alternating quads catch and lose
the key light. That is the reported striping.

### The fix

Share the wall vertices between neighbouring quads unless the contour genuinely
turns hard (`WALL_CREASE_DEG = 60`). Sharing lets `computeVertexNormals` average
the two faces, and the average of a symmetric zig-zag is the true surface
direction — the alternation cancels instead of being drawn. Junctions past the
crease angle keep independent vertices, so real corners stay sharp.

**Positions are unchanged.** The silhouette, mask fidelity, hole topology and
export shape are exactly what they were; only the normals and the vertex count
move.

### Measured

| | before | after |
|---|---|---|
| vertices | 918 | **614** |
| rim vertices | 612 | **308** |
| triangles | 608 | **608** |
| bbox | 2.0869 × 0.94 × 0.1484 | **2.0869 × 0.94 × 0.1484** |
| rim split groups | 306 | **2** (the two genuine 91° end corners) |

Triangles and bounding box identical, vertices down a third: that is the exact
signature of a normals-only change, and it is what the geometry net reports on
every shape (Solid `verts −32…−33%`, `tris =` on all eight).

Before/after crops: `solid-rim/{before,after}/close_az_004.png` and
`close_el_012.png` — hard alternating light/dark bands become one continuous
gradient. A faint ripple survives in the most foreshortened part of the sweep;
that is the half-pixel contour itself, now shaded as the gentle undulation it
geometrically is rather than as a ladder.

---

## 4. Marquee bulbs — a bulb is round

### What was actually wrong

The glyph table is a **5×5 bitmap**, and the sampler quantises the cell with
`floor()`: a lit bit fills its whole 1/5-of-a-cell square, hard edge to hard edge.
For letterforms that is exactly right — the strokes of a `#` or a box-drawing
glyph *are* square-ended. For the dot alphabets it is not. The braille cells the
Marquee stack lights along the neon tube are meant to read as **bulbs**, and
nothing in the shader ever drew a circle.

### The fix

Sample the same bitmap **continuously**. Work in glyph-pixel space (the cell is
5×5 units); for the 3×3 neighbourhood of lit bits around the current position,
measure the distance to each bit's centre. Coverage is a radial falloff about
that centre, and the neighbourhood max composites touching dots into one blob
instead of clipping them at the bit boundary:

```glsl
#define FS_BULB_CORE 0.24
#define FS_BULB_EDGE 0.46

float fsGlyphDot(int idx, vec2 inCell) {
  vec2 gp = inCell * 5.0;
  vec2 base = floor(gp);
  float cov = 0.0;
  for (int dy = -1; dy <= 1; dy++)
    for (int dx = -1; dx <= 1; dx++) {
      vec2 g = base + vec2(float(dx), float(dy));
      if (fsGlyphPixel(idx, g) < 0.5) continue;
      float d = length(gp - (g + 0.5));
      cov = max(cov, 1.0 - smoothstep(FS_BULB_CORE, FS_BULB_EDGE, d));
    }
  return cov;
}
```

`d < CORE` is full brightness — the filament. `CORE < d < EDGE` is the
smoothstep shoulder — the glass, and the antialias. `EDGE = 0.46` is deliberately
just under half a glyph pixel so neighbouring bulbs keep a dark gap: a marquee is
a row of separate lamps, and the gap is what makes you read it as lamps rather
than as a lit tube.

### Scoping: braille only, and why

`fsIsDotCharset` returns true for charset 5 (braille) alone. The `dots` charset
is also a dot alphabet and round would be conceptually right there too, but it is
used by Sparse Glyph at an **8px cell** — a glyph pixel is then 1.6 device
pixels, which has no room to read as a circle and only loses light. Measured over
the ink region, mean luminance fell **57.8 → 21.7 (−62%)** when that preset was
rendered with round dots, turning a subtle overlay into almost nothing. Braille
runs at the Marquee stack's 22px cell — 4.4px per glyph pixel, enough room for a
bulb. If `dots` is ever wanted round, its presets need re-tuning for the lost
coverage first.

### Measured

`scripts/verify/verify-marquee-bulbs.mjs` applies presets through
`__styleHarness.selectPreset` — the same function the preset rail calls — and
nearest-neighbour magnifies crops so a bulb's actual pixel footprint is visible
rather than resampled into a blur. Mean per-pixel change, before vs after:

| Preset | charset | Δ |
|---|---|---|
| `marqueeStack` | braille | **0.173** |
| `sparseGlyph` | dots | 0.000 |
| `blueprintStack` | boxes | 0.000 |
| `terminalShade` | classic | 0.000 |

Exactly one case moved. Crops: `marquee-bulbs/{before,after}/marquee_braille_zoom1.png`
— hard pink squares become round lamps with a falloff.

---

## 5. The regression net

`before-gaps` → `after-gaps`, all four modes × eight shapes:

- **Rod** — triangles −8% to −42%, bytes −9% to −38%. Intended.
- **Solid** — vertices −32…−33%, **triangles `=` on every shape**, bytes −18…−25%.
  The normals-only signature.
- **Extrude** — **byte-identical (`=`) on every metric, every shape.** Untouched.
- **Inflate** — vertices and triangles `=` on every shape. Untouched.

`verify-gates.mjs`: **ALL GATES PASS**, 0 console errors.
`verify-timing-note.mjs`: **PASS** — every note matched what the renderer produced.

---

## 6. Still weak

- The rod ceiling is absolute (one ring per half radius). A stroke drawn at a
  very large tube radius is bounded by that, not by curvature; nothing observed
  hits it today, but it is a fixed number rather than a derived one.
- The Solid rim's residual undulation is the half-pixel Douglas–Peucker contour
  itself. Smoothed normals hide it; only a sub-pixel-accurate contour would
  remove it.
- Round bulbs are braille-only. The `dots` charset stays square until its presets
  are re-exposed for the 62% coverage loss.
- The timing note reports **speed only**. Pressure is recorded and carried
  through processing, and nothing reads it — the note says so, which is honest,
  but a pressure-aware reveal or width modulation is still unbuilt.
- DEV capture mode takes the viewport out of flow and turning it off does not
  restore the control bar's laid-out width in the same tick. Dev-only, invisible
  to users, but it cost two verification runs before it was spotted, and any
  future script that screenshots UI after a capture run will hit it.

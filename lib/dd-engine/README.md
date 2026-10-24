# `lib/dd-engine/` — the Desk Doodles engine, ported as files

**Source repo:** `~/Desktop/Projects/desk-doodles` @ `cb97683` (the canonical
clone — a second copy exists at `~/desk-doodles` at the same commit without
dependencies installed; do not read that one).

**Ported:** 2026-07-29.

Everything in this directory except `adapter.ts`, `external-types.ts` and this
README is a Desk Doodles file **copied across**, not reimplemented. Every
constant, curve shape, seeded epsilon, joint rule, resampler, smoothing pass and
**every explanatory comment** came over intact. Those comments are the record of
what was tried and why it failed — `strokeTo3d.ts` alone carries the
closed-loop RDP collapse (BUG 2), the Infinity-OOM boundary guard (BUG 1), the
flat-pressure-channel root-cause, the LOW-3 open/self-intersecting slab guard,
the staircase-collapse epsilon and the corner-pin derivation. Rewriting them
destroys the only copy.

Each file carries its own header naming its source path and listing **exactly**
what changed to make it compile here. Nine of the fourteen changed nothing at
all beyond that header.

---

## What is here

| file | source | changed |
|---|---|---|
| `strokeTo3d.ts` | `lib/geometry3d/strokeTo3d.ts` | nothing — it imports only `three` |
| `markIntent.ts` | `lib/geometry3d/markIntent.ts` | import specifiers |
| `convert.ts` | `lib/geometry3d/convert.ts` | import specifiers |
| `conversionMap.ts` | `lib/smart/conversionMap.ts` | import specifiers |
| `coverage.ts` | `lib/smart/coverage.ts` | nothing — no imports |
| `deskRenderMode.ts` | `lib/geometry3d/deskRenderMode.ts` | import specifiers |
| `fallbackLadder.ts` | `lib/geometry3d/fallbackLadder.ts` | import specifiers |
| `hardPath.ts` | `lib/geometry3d/hardPath.ts` | import specifier |
| `sealedRelief.ts` | `lib/geometry3d/sealedRelief.ts` | nothing |
| `modeParams.ts` | `components/canvas3d/modeParams.ts` | nothing — no imports |
| `materials3d.ts` | `components/canvas3d/materials3d.ts` | nothing — no imports |
| `rodAdornments.ts` | `components/canvas3d/rodAdornments.ts` | import specifier |
| `handFeel.ts` | `lib/handFeel.ts` | nothing; `perfect-freehand` added to package.json |
| `f3HandFeel.ts` | `lib/f3HandFeel.ts` | nothing |

Plus two files that are **not** ports:

- **`external-types.ts`** — five string unions that four of the ported files
  imported from Desk Doodles modules outside the engine (its smartHachure
  classifier, its Canvas3D React context, its hatch shader). Re-declared
  verbatim with the source file and line for each, rather than dragging the 2D
  pipeline and a React context tree along with the geometry.
- **`adapter.ts`** — Free Stroke's `GeometryEngine` interface implemented on top
  of the ported builders. **This is where all Free Stroke adaptation lives.** If
  the engine needs to behave differently here, change the adapter, not a port.

The `.ts` suffixes Desk Doodles uses on relative imports (`'./strokeTo3d.ts'`)
are legal under Vite but not under this repo's tsconfig, which does not set
`allowImportingTsExtensions`. Stripping them is the bulk of the "import
specifiers" column.

---

## What was NOT ported, and why

- **`lib/geometry3d/csg.ts`** — the manifold-WASM deep-relief CSG pass. It needs
  the `manifold-3d` package (a WASM dependency this repo does not carry) and it
  imports `components/canvas3d/drawingTexture.ts` (75 KB of 2D rasterisation)
  and `lib/fill/regionFill.ts`. It is not part of the stroke→geometry engine;
  it carves relief into a form that already exists, using a height field
  produced by Desk Doodles' 2D renderer, which Free Stroke does not have. Adding
  it means porting the 2D pipeline, which is a different job.
- **`components/canvas3d/Stroke3DScene.tsx` (2319 lines) and `HardMesh.tsx`** —
  React scene components, not engine. Their geometry-side content is the
  builders in `strokeTo3d.ts` (ported) plus `rodAdornments.ts` (ported) plus
  material/mode tables (ported). What is left is R3F wiring against their
  Canvas3D context, their desk object model and their AI-mesh GLB path.
- **`drawingTexture.ts` / `hatchMaterial.ts` / `aiMeshMaterial.ts`** — surface,
  not geometry, and all three are built on Desk Doodles' 2D marks.

---

## How it is reached

`lib/engine-registry.ts` exposes `getEngineFor(mode, family)`. `family` is
`"free-stroke"` (default, unchanged) or `"desk-doodles"`. The switch is a pill
row in the header on both `/` and `/desk-doodles`, and both routes expose it to
capture scripts (`window.__styleHarness.setEngine(...)` on the lab,
`window.__engineHarness.setEngine(...)` on the hero route).

**Free Stroke's own engine is not deleted, not modified, and still the default.**

---

## The one thing worth knowing before reading the adapter

The two apps disagree about how big a world unit is: Free Stroke maps the
canvas's long side to 3 units, Desk Doodles maps 800px to 8. The adapter runs
the whole Desk Doodles pipeline **in Desk Doodles' units** and applies one
uniform scale to the finished geometry, rather than feeding their normaliser
Free Stroke's scale.

That is deliberate, and the reason is in the adapter header at length: their
tuning is a web of absolute world lengths, most of them module-private with no
option to override — `ROD_RESAMPLE_SPACING`, `DEDUPE_MIN_DIST`,
`MIN_EXTRUDE_AREA`, `SOLID_MIN_LOOP_AREA`, the `CLOSE_GAP_PX × WORLD_SCALE`
world-closure test, Inflate's base-radius-to-length clamp. Running their code at
a third of the world scale it was tuned at silently changes what counts as a
duplicate point, a closed loop, a degenerate area and a corner. That would be
their engine mistuned, which is the exact failure this port exists to avoid.

The scale works out to `300 / max(w, h)` — about 0.3 on a ~1000px canvas, which
is the same DD→FS factor `docs/research/extrude-solid-quality.md` derived
independently, and the exact inverse of the `×8/3` Desk Doodles applied when it
took Rod *from* Free Stroke.

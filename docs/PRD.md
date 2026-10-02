# Free Stroke — Full Updated Project Plan, Phase Map, Progress Tracker, and Status

> Source of truth for the build loop. Pasted by Sebs 2026-07-27. Progress annotations in
> `SESSION-HANDOFF.md` supersede the static status lines here — several early phases are
> already built (style substrate, preset rails, taxonomy correction, material + animated
> material + custom material + env-map readability). The build loop resumes at
> `POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1`.

## 0. Current truth

Free Stroke has moved past the pure geometry-survival stage. The MVP engine layer is now
basically real: Rod works. Extrude works. Solid works. Inflate works. Animation works
acceptably across modes. Export works.

The geometry modes are usable enough to stop treating every next step like an engine rescue.
The old roadmap is outdated because it underdefined the product-surface layer.

The next major work is not simply "materials" or "style presets." The real product layer is:

- material presets
- animated material
- procedural texture
- animated procedural texture
- dither
- animated dither
- ASCII
- animated ASCII
- layer stacking
- animated layer stacking
- fusion/composite visual systems
- animated fusion modes
- preset families
- advanced geometry animation controls
- texture/visual sync controls
- iOS-style UI/control polish

**The important correction:** Material, texture, dither, ASCII, animated material, animated
texture, animated dither, animated ASCII, animated layer stack, animated fusion, and presets
are **separate systems**. They can overlap visually, but they should not be mentally collapsed
into one vague "shader stuff" bucket.

## 1. Project definition

Free Stroke is a drawing-to-3D creative tool. A user draws a 2D stroke. The app turns that
gesture into stylized 3D geometry, lets the user choose the physical form of the stroke,
layers visual systems onto that form, animates the geometry and the surface, and exports
usable 3D output.

**Product promise:** Draw something by hand, turn it into an animated 3D ink/sculptural
object, style it with procedural visual layers like dither and ASCII, animate those layers,
and export something that feels authored.

**North star:** A user should be able to draw an expressive stroke, switch between geometry
modes, apply visual layers, animate both the object and the surface, and export a result that
feels like a designed artifact rather than raw technical conversion.

**The real stack (what makes Free Stroke interesting):** Authored stroke gesture → Geometry
mode → Geometry animation → Material → Animated material → Procedural texture → Animated
procedural texture → Dither → Animated dither → ASCII → Animated ASCII → Layer stacking →
Stack-level animation → Fusion/composite visual systems → Animated fusion modes → Presets →
Export. That combination is the product.

## 2. Core layered model

- **Layer 1 — Stroke input.** Raw points, processed points, stroke order, stroke timing,
  smoothing, resampling; pressure/taper/metadata later. *What did the user draw?*
- **Layer 2 — Geometry mode.** Rod, Extrude, Solid, Inflate. *What physical form does the
  stroke become?*
- **Layer 3 — Geometry animation.** Now: draw-in reveal, play/replay, speed, final-frame
  matching. Future: easing, delay, loop, reverse, reveal style, stroke order controls,
  pressure-aware reveal, tip highlight, completion pulse, settle/wobble, secondary motion.
  *How does the geometry appear over time?*
- **Layer 4 — Material.** Color, roughness, metalness, clearcoat, shine, softness,
  gel/rubber/clay/plastic feel; opacity/transmission later. *What is the object made of?*
- **Layer 5 — Animated material.** Roughness pulsing, shine sweep, clearcoat movement, gel
  shimmer, color shift, emissive flicker, specular highlight drift, reveal-synced material
  pulse. Tasteful and subtle by default. *How does the surface material change over time?*
- **Layer 6 — Procedural texture.** Grain, noise, scanlines, bands, scratches, ripple
  patterns, contour lines, paper-like fibers, rubber grain, gel bubbles. Texture ≠ material.
  *What visual pattern lives on the surface?*
- **Layer 7 — Animated procedural texture.** Noise drift, grain crawl, scanline movement,
  ripple motion, band scrolling, texture pulse, reveal-reactive texture. *How does the surface
  pattern move over time?*
- **Layer 8 — Dither.** Threshold-based graphic reduction: ordered/Bayer thresholding,
  halftone-like breakup, dot/cell patterns, binary/limited-tone conversion, tonal reduction.
  Should feel like a graphic rendering system, not random texture. *How is tone broken into
  graphic marks?*
- **Layer 9 — Animated dither.** First-class: threshold crawl, Bayer matrix offset, moving
  dither grid, animated dot threshold, dither wave sweep, reveal sync, flicker/pulse,
  direction controls, screen/object-space motion. Animated texture moves a pattern; animated
  dither moves a thresholding system.
- **Layer 10 — ASCII.** Character/glyph-based rendering: character sets, glyph grid,
  brightness-to-character mapping, density, terminal-like rendering, monospace cell
  structure. Sets: `.:-=+*#%@`, `01`, `░▒▓█`, `<>/{}[]`, custom later. *How is the object
  represented through characters?*
- **Layer 11 — Animated ASCII.** First-class: scrolling glyph fields, character cycling,
  random replacement, reveal-synced density, ASCII rain, shimmer, glyph crawl, animated
  brightness thresholds, field phase/speed/direction. Glyph motion ≠ pattern motion ≠
  threshold motion.
- **Layer 12 — Layer stack.** Multiple visual systems stack while remaining independently
  editable: on/off, reorder, intensity, per-layer animation choice.
- **Layer 13 — Stack-level animation.** The whole stack animates as a group/container
  (Photoshop group / AE precomp analogy): fade stack in, pulse intensities together, drift
  together, delay until reveal finishes, freeze at final frame, loop as one group. Not fusion —
  layers stay separate.
- **Layer 14 — Fusion / composite styles.** Layers combine into a new authored visual system
  with shared parameters and mutual influence (e.g. Terminal Gel, Dither Bloom). Fusion should
  produce named, recognizable aesthetics.
- **Layer 15 — Animated fusion modes.** A fusion preset with its own choreography: layers
  influence each other over time (ASCII density drives dither threshold; reveal progress
  controls relationships; completion triggers shared pulse). *A single animated visual
  instrument.*
- **Layer 16 — Presets.** Preset families exist at every level (geometry, material, animated
  material, texture, animated texture, dither, animated dither, ASCII, animated ASCII, layer
  stack, stack animation, fusion, animated fusion, geometry animation, export/view later).
  Guardrail: presets give good taste fast; they never hide broken systems or replace editable
  controls.

## 3. The four visual animation levels

- **A. Individual layer animation** — one layer moves by itself (ASCII scrolls, dither
  crawls, grain drifts, material shimmers). Modular and editable.
- **B. Stack-level animation** — the whole stack animates as a group (fades in, pulses,
  drifts, syncs to reveal, freezes on completion). Group/container animation.
- **C. Fusion animation** — layers influence each other inside one authored system. Behavior
  choreography.
- **D. Geometry animation** — the 3D object reveals or moves (draw-in, loop, reverse, ease,
  tip highlight, completion pulse). Object animation.

## 4. Clear definitions and guardrails

- **Material** controls physical surface response (color/roughness/metalness/clearcoat/
  reflectivity; opacity/transmission/sheen later). Must NOT control ASCII characters, dither
  threshold, geometry shape, or draw-in timing.
- **Animated material** = time-varying surface response. Subtle by default; not random
  flashing. Does not replace animated texture/dither/ASCII.
- **Texture** is a spatial pattern. If it's threshold cells → call it dither. If characters →
  ASCII. If pattern/noise/marks → texture.
- **Animated texture** = pattern motion. Not secretly animated ASCII or dither.
- **Dither** needs threshold logic — not random noise.
- **Animated dither** = threshold/matrix/phase motion with controls (speed, direction,
  threshold, phase, intensity, sync). Must still look like dither or it failed.
- **ASCII** must be character-driven, not a generic image texture.
- **Animated ASCII** = glyph/grid/density/mapping motion with controls (charset, cell size,
  scroll speed, direction, density, randomization, sync, reveal amount). Should not become
  unreadable noise unless the user chooses chaos.
- **Layering** = independent systems stack, stay editable (enabled, intensity, blend mode,
  order, animation, sync). Default layering must be tasteful — no visual soup.
- **Animated layering** = each layer animates independently inside the stack (per-layer
  toggle/speed/direction/phase/delay/loop/sync). Never force all layers to animate together.
- **Stack-level animation** = the whole group animates as a container (enabled, intensity,
  opacity, speed, direction, phase, delay, loop, reveal sync, completion pulse, freeze).
  Stack animation moves the group; fusion links systems.
- **Fusion** defines relationships, not just a saved slider state. A fusion preset needs a
  concept.
- **Animated fusion** = the relationships evolve over time (controls: preset, speed,
  intensity, sync, chaos/readability, reveal influence, completion behavior, relationship
  strength). Choreographed, not random motion.

## 5. Geometry mode model

All four modes are MVP-ready and LOCKED (do not reopen without a proven regression).

- **Rod** — clean 3D ink/tube; gesture-preserving. Should take every visual system well.
- **Extrude** — ribbon/calligraphic strip. Especially good for: dither on broad faces,
  ASCII along stroke direction, scanlines, shine sweeps, directional texture.
- **Solid** — filled silhouette/cutout with holes/counters. Especially good for: dither
  fields, ASCII fills, reveal-synced texture, readable broad surfaces.
- **Inflate** — soft pressure-filled volume (gel/rubber/air). Especially good for: soft gel
  material, shimmer, subtle texture, ASCII skin, dither highlights, Terminal Gel / Scanline
  Balloon fusions.

## 6. Preset system model

Preset rule: a preset is understandable, visually distinct, editable after selection,
mode-aware, safe by default, not overloaded.

- **Family 1 — Geometry presets:** Clean Rod, Bold Rod, Ribbon Strip, Deep Ribbon, Solid
  Cutout, Soft Balloon Stroke.
- **Family 2 — Material:** Ink, Soft Gel, Matte Clay, Glossy Plastic, Rubber, Signal. *(built)*
- **Family 3 — Animated material:** Shine Sweep, Gel Shimmer, Roughness Pulse, Completion
  Flash, Signal Flicker. *(built)*
- **Family 4 — Texture:** Fine Grain, Scanlines, Contour Bands, Scratched Ink, Gel Bubbles.
- **Family 5 — Animated texture:** Grain Drift, Scanline Scroll, Ripple Flow, Band Crawl,
  Bubble Drift.
- **Family 6 — Dither:** Bayer Classic, Dot Matrix, Hard Threshold, Soft Dither, Pixel Signal.
- **Family 7 — Animated dither:** Dither Crawl, Threshold Sweep, Reveal Dither, Completion
  Pulse Dither, Diagonal Matrix Drift.
- **Family 8 — ASCII:** Terminal Shade (`.:-=+*#%@`), Binary Skin (`01`), Block Glyph
  (`░▒▓█`), Code Marks (`<>/{}[]`), Sparse Glyph.
- **Family 9 — Animated ASCII:** Glyph Scroll, ASCII Rain, Character Cycle, Reveal Glyphs,
  Terminal Flicker, Slow Code Crawl.
- **Family 10 — Layer stacks:** Clean Ink Stack, Dithered Gel Stack, Terminal Stack, Graphic
  Slab Stack, Soft Signal Stack.
- **Family 11 — Stack animation:** Stack Fade In, Stack Completion Pulse, Stack Drift, Stack
  Freeze On Complete, Stack Loop Crawl, Stack Delay.
- **Family 12 — Fusion:** Terminal Gel (Inflate), Dither Bloom (Solid/Extrude), Signal Ink
  (Rod/Extrude), ASCII Rubber (Inflate/Rod), Scanline Balloon (Inflate), Pixel Clay (Solid),
  Code Bloom (Extrude/Solid), Glitch Ribbon (Extrude) — each defines RELATIONSHIPS between
  systems.
- **Family 13 — Animated fusion:** Terminal Gel Reveal Build, Dither Bloom Threshold Open,
  Signal Ink Data Flow, ASCII Rubber Slowdown, Scanline Balloon Soft Pulse, Glitch Ribbon
  Controlled Break, Code Bloom Character Reveal.
- **Family 14 — Geometry animation:** Authentic Draw, Smooth Reveal, Snappy Draw, Slow Gel,
  Looping Stroke, Completion Pulse.
- **Family 15 — View/export presets (later):** Portfolio Spin, Top-Down Mark, GLB Clean
  Export, Video Preview Export.

## 7–9. Roadmap layers and phases

- **Layer A** Core MVP geometry loop — DONE.
- **Layer B** MVP cleanup + demo readiness — DONE (`MVP_UI_POLISH_AND_DEMO_CAPTURE_PASS`).
- **Layer C** Visual system primitives — IN PROGRESS (substrate + material/animated material
  done; texture/dither/ASCII next).
- **Layer D** Preset foundation — rails DONE; families fill in as renderers land.
- **Layer E** Layer stack + stack animation — after primitives.
- **Layer F** Fusion + animated fusion — after layering.
- **Layer G** Advanced geometry animation controls — after visual substrate.
- **Layer H** iOS-style product UI — after core systems.
- **Layer I** Robust geometry / export fidelity — later; only if blocked.

**Phase status:** Phases 0–6 (shell, stroke capture, Rod, Extrude, Solid H3, Inflate,
cleanup) DONE. Phase 7 style substrate DONE. Phase 8 preset rails DONE. Phase 9 material
presets DONE. Phase 10 animated material DONE. **Phase 11 procedural texture — NEXT.**
Phase 12 animated texture. Phase 13 dither. Phase 14 animated dither. Phase 15 ASCII.
Phase 16 animated ASCII. Phase 17 texture timing system (globalStyleTime, localLayerTime,
sync modes: independent / reveal synced / delayed / completion pulse / stroke-time / loop).
Phase 18 layer stack (blend modes start simple: normal, multiply, screen; overlay/threshold
later; ONE dominant graphic layer by default). Phase 19 stack-level animation. Phase 20
fusion presets. Phase 21 animated fusion. Phase 22 geometry animation controls v1 (speed,
duration, delay, loop, reverse, easing, reveal styles: authentic/smooth/presentation/snappy/
slow gel). Phase 23 texture+geometry sync. Phase 24 advanced animation polish. Phase 25 MVP
UI cleanup (done). Phase 26 iOS-style control panel v1. Phase 27 preset browser.

**Phase gates (non-negotiable):**
- Style state changes must not rebuild geometry unless absolutely necessary.
- Texture must be visually distinct from dither and ASCII.
- Animated dither must still look like dither, not moving noise.
- Animated ASCII must still feel character-driven.
- Stack: dither + ASCII + texture + material coexist without unreadable soup.
- Fusion presets feel authored, not saved random settings.
- A fusion mode feels like a new visual instrument.

## 12. Export roadmap

v1 (current): static GLB geometry per mode. v2: material preset metadata in GLB. v3: static
texture/dither/ASCII baking (UV or generated coordinates, image maps). v4: animated preview
export — video-first. v5: true animated GLB (later/harder). **Do not block style preview on
export baking. Preview first, bake later.**

## 13. Robust geometry roadmap (later, only if blocked)

Robust Extrude Option B (raster/SDF contour) preferred over Option A (polygon offset/
boolean). Advanced Inflate (implicit field, metaballs, marching cubes) after the style
system.

## 14. Progress tracker

Geometry + engine + material rows: MVP-ready/done. Texture, animated texture, dither,
animated dither, ASCII, animated ASCII, layer stack, animated layering, stack animation,
fusion, animated fusion, iOS UI: not started — build in that order. Robust Extrude /
Advanced Inflate: future, only if needed.

## 15. Blockers and risks

**Current blocker: roadmap discipline.** The engines are stable; the danger is a new
geometry rabbit hole instead of the visual system. The style/texture/layer/fusion system is
large — build strictly in order: cleanup → substrate → preset rails → material → animated
material → texture → animated texture → dither → animated dither → ASCII → animated ASCII →
timing/sync → layer stack → per-layer animation → stack animation → fusion → animated
fusion → advanced geometry animation → iOS UI. Do not start fusion before individual
systems. Do not start animated fusion before fusion. Do not start stack animation before the
layer stack. Do not build a massive preset browser before the preset data model.

## 16. Recommended next sequence (branch names)

1. ~~MVP_UI_POLISH_AND_DEMO_CAPTURE~~ ✅
2. ~~POST_MVP_STYLE_SUBSTRATE_PHASE_1~~ ✅
3. ~~POST_MVP_INITIAL_PRESET_RAILS_PHASE_1~~ ✅
4. ~~POST_MVP_MATERIAL_AND_ANIMATED_MATERIAL_PHASE_1~~ ✅ (incl. env-map readability +
   custom material fixes)
5. **POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1 ← current**
6. POST_MVP_DITHER_AND_ANIMATED_DITHER_PHASE_1
7. POST_MVP_ASCII_AND_ANIMATED_ASCII_PHASE_1
8. POST_MVP_VISUAL_TIMING_SYSTEM_PHASE_1
9. POST_MVP_LAYER_STACK_PHASE_1
10. POST_MVP_ANIMATED_LAYERING_AND_STACK_ANIMATION_PHASE_1
11. POST_MVP_FUSION_PRESETS_PHASE_1
12. POST_MVP_ANIMATED_FUSION_MODES_PHASE_1
13. POST_MVP_ADVANCED_GEOMETRY_ANIMATION_CONTROLS_PHASE_1
14. POST_MVP_IOS_CONTROL_PANEL_PHASE_1

## 17. Final operating rules

- Do not touch geometry unless something breaks.
- Material / texture / dither / ASCII are separate systems; so are their animated versions.
- Layering = stack + editable. Animated layering = layers animate individually. Stack
  animation = the group animates. Fusion = systems combine with relationships. Animated
  fusion = relationships move.
- Presets are starting points, not replacements for editable systems.
- Export baking is later; preview first.
- Build presets before exposing every advanced control.
- If a control cannot be explained clearly, it should not ship.
- The next product leap is animated visual style, not another geometry mode.

## Build-loop standing rules (Sebs, 2026-07-27)

- **Every edit needs video/images analyzed** — always maximize frame count. No pass calls
  from code inspection alone.
- **Docs required:** `docs/explainers/` (code, tech, math, reasoning — deeper on
  math/graphics, lighter on design), `docs/research/` (every online source: what it is, what
  it does, what we used it for, with saved visuals).
- Fable model for hand-feel judgment passes only; Opus for pipeline/system builds.

# Chat History — Desk Doodles 3D Word Reveal + Logo Flip

A running log of what's been built in this chat, in order.

## 1. Style & material harness
- Added `window.__styleHarness` (dev-only) to `components/viewport-3d.tsx` / wired via `app/page.tsx`, exposing:
  - `setMode(mode)` — switch geometry mode (e.g. `inflate`, `extrude`, `solid`).
  - `setMaterial(preset)` — apply a named material preset (`ink`, `custom`, etc).
  - `setCustom(params)` — patch the `custom` material preset's fields (color, roughness, metalness, clearcoat, sheen, emissiveIntensity, envMapIntensity). Needed because named presets like `ink` are locked to their own roughness (0.3); to get "ink look at roughness 0.35" the `custom` preset must be selected and seeded with ink's values plus the roughness override.
  - `injectStrokes(polylines, opts)` — feed custom stroke polylines into the drawing pipeline with `msPerPoint` / `gapMs` timing control, so any text/shape can be driven into the 3D reveal system programmatically instead of manually drawing on the canvas.

## 2. Reveal harness
- Added `window.__revealHarness` for scripted control of the draw-in animation:
  - `setProgress(value)` — jump the playhead (0..1) directly. Implementation note: `SolidAnimationTick` (in `Scene`) is always enabled for solid/extrude/inflate modes and reads `playheadRef` every frame, propagating it into `solidAnimProgress` — so the harness only needs to set the ref; it doesn't need its own setter in a different scope.

## 3. Capture harness (dev-only transparent render target)
- Added `window.__captureHarness` to `Viewport3D`:
  - `enable()` / `disable()` — toggles a fixed **1920×1080 transparent** render target: the container goes `position: fixed`, background transparent, grid hidden (`hideGrid` prop threaded into `Scene`), Canvas `dpr` forced to 1, and `gl={{ alpha: true, preserveDrawingBuffer: true }}`.
  - `size()` — returns `{width, height}` of the capture target.
  - `frontView(fillK)` — snaps the camera to a front-on framing (`(0,0,dist)` looking at the bounds center) instead of the default isometric `(1,1,1)` orbit angle, so the word faces the camera flat — required to match the flat 2D logo's orientation for the flip.
  - `grab()` — returns `canvas.toDataURL("image/png")` from the WebGL backing buffer, which preserves the alpha channel (a page screenshot would not).
  - Guarded entirely behind `process.env.NODE_ENV !== "production"`.

## 4. ffmpeg-static binary was missing
- `ffmpeg-static`'s postinstall didn't run (pnpm skipped it), so the binary was a 0-byte/missing file. Fixed by running `node node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/install.js` directly to force the download (~80MB). Verified `libvpx-vp9` encoder is present and supports `yuva420p` (alpha) pixel format — confirming transparent WebM export is possible from this environment.

## 5. Logo asset
- Saved the user-provided flat "Desk Doodles" logo to `public/desk-doodles-logo.png` (5515×1215px, wide aspect ratio).

## 6. `scripts/capture/` — capture & compose pipeline
Everything lives in `scripts/capture/` (NOT `.v0/capture/`, which is gitignored and gets wiped between commands — learned this the hard way after losing work twice).

- **`letters.mjs`** — hand-authored vector stroke font (single-line/skeleton letterforms, arcs + line segments) with a `layoutWord(text, {x,y,size})` function that lays out a string into polylines. Iterated several times to fix broken glyphs (`e`, `s`, `d` were initially malformed/illegible — fixed by rebuilding their arc parameters with correct sweep directions and shared junction points).
- **`debug-font.mjs`** — fast 2D-only renderer of `letters.mjs` output to a PNG, used to visually check glyph legibility without paying the cost of a full 3D capture cycle.
- **`trace-logo.mjs`** — attempted to extract the *actual* logo shape via Zhang-Suen skeleton thinning + path tracing (so the 3D word would be pixel-faithful to the hand-drawn logo). Normalizes/rescales traced output to a ~1100px-wide target and densifies polylines (~3px steps) so the inflate engine's fixed ~22px tube radius reads as bold, continuous strokes instead of thin fragments.
  - **Result: not usable as-is.** The skeleton trace fragments into ~107 disconnected polyline segments at glyph junctions; when inflated, these render as spiky, disconnected blobs rather than clean tubes. The hand font (`letters.mjs`) inflates far more cleanly because its strokes are already continuous single lines.
- **`debug-trace.mjs`** — 2D debug renderer for the traced skeleton output (same purpose as `debug-font.mjs`, for the logo trace).
- **`capture-frames.mjs`** — orchestrates the actual 3D capture:
  1. Opens/uses the live dev preview via `agent-browser`.
  2. Injects a stroke source (font layout or traced logo) via `__styleHarness.injectStrokes`.
  3. Sets material to `custom` seeded with ink-like values (`color:#1a1a1a, roughness:0.35, metalness:0, clearcoat:0, sheen:0, emissiveIntensity:0, envMapIntensity:1`).
  4. Enables capture mode + front-view framing.
  5. Steps `__revealHarness.setProgress()` across `DRAW_FRAMES` (default 60) evenly-spaced values from 0→1, grabbing a PNG at each step, plus one final `3d_full.png` at progress=1.
  6. Frames are written to `scripts/capture/frames/`.
- **`compose.mjs`** — the flip compositor. Two modes:
  - `MODE=logo-only` — flat logo-only flip: holds the static logo, does a horizontal card-flip (scaleX squash-and-mirror illusion) as a standalone transition, no 3D draw-in involved. **This is the variant that has been fully completed and encoded.**
  - Default/3D mode (in progress) — draw-in reveal using `frames/`, hold, card-flip from the final 3D frame to the flat logo (logo scaled to match the 3D word's measured bounding box so lengths/heights align as closely as possible), hold, flip back to 3D, per the user's "all three" request.
  - Output frames go to `scripts/capture/composed/`.
- **`encode.mjs`** — encodes `composed/*.png` to a transparent WebM via `ffmpeg-static` + `libvpx-vp9`, `-pix_fmt yuva420p`, honoring an `--out=<path>` CLI arg (relative to the script's directory).

## 7. Bounding-box measurements (for alignment)
- 3D word (front-view, full reveal, hand font "Desk Doodles"): bbox **885×110px**, centered at **(958, 540)** within the 1920×1080 capture frame.
- Logo file native size: **5515×1215px**.
- Plan: scale the logo down to match the 3D word's *width* (885px) and center it on the same point, so the flip transition lines up in length as closely as possible (heights differ due to differing aspect ratios between a thin line-drawn word and a fuller logo mark, so width-matching was prioritized).

## 8. Encoder/binary hiccups along the way
- The `ffmpeg-static` binary went missing a second time (looked like an encoder crash) — root cause was the same postinstall-skipped issue recurring after an environment refresh; re-ran the install script to restore it.
- `.v0/` gets wiped between tool calls in this environment (it's gitignored); anything meant to persist across turns must live under `scripts/` (tracked, persists) instead.

## 9. Variant decision — user asked for "all three"
When asked how the 3D word should relate to the flat logo, options were:
- **(A) Trace the logo exactly** — best shape fidelity, but inflate renders it as broken/spiky blobs (unresolved).
- **(B) Clean rounded hand-font, sized to the logo's footprint** — inflates cleanly, reads legibly, doesn't match exact handwriting but aligns in length/height. Font glyph fixes (e/s/d) were completed for this path.
- **(C) Skip the 3D word; animate only the flat logo (flip transition only)** — simplest, most reliable. **Completed**: composed and encoded to `public/videos/desk-doodles-logo-flip.webm`, verified via decoded-frame alpha channel inspection (~2.05M fully transparent px vs ~20K opaque logo px in a sampled mid-video frame — true alpha, not a black/white matte).

User chose **all three** — task list is tracking them as separate deliverables:
1. ~~Build shared flip compositor and transparent WebM encoder~~ — done.
2. ~~Variant C: flat-logo-only flip video~~ — done, output at `public/videos/desk-doodles-logo-flip.webm`.
3. **Variant B: clean rounded font inflated, logo-sized** — in progress. Font glyphs fixed and verified via `debug-font.mjs`; next step is wiring the fixed font into `capture-frames.mjs`, capturing 3D frames, composing the flip against the logo, and encoding.
4. **Variant A: traced-logo inflated to match handwriting** — blocked on making the skeleton trace inflate cleanly (needs either a better tracing/simplification approach that yields fewer, longer continuous strokes, or a different geometry mode better suited to filled/traced shapes than tube-inflate).

## Current state / next steps
- Variant C is shippable now.
- Variant B needs: re-point `capture-frames.mjs` at the fixed `letters.mjs` layout (sized to match the logo's aspect/footprint), run the capture → compose (3D mode, not logo-only) → encode pipeline.
- Variant A needs a tracing rework before it's usable — likely reducing/merging trace fragments into fewer continuous paths before inflate, or switching Variant A to a non-tube geometry mode.

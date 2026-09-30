# EXPORT-FORMATS lane log, 2026-09-30 (cloud session, branch claude/export-formats-implementation-rs226x)

Brief: GIF, transparent WebM and an animated GLB of the draw-in, each in the existing export bar, each with a gate (decodes, frame count and size, first and last frames match live, a must-fail). Coverage rows 92, 94, 96 of `docs/research-2026-09-26/animation-asks-coverage.md`. Nothing merges; the owner reviews. Earlier lanes' logs follow below this section, unchanged.

## Setup, and what differs from the owner's Mac
- `pnpm install --frozen-lockfile` FAILS on this snapshot: `pnpm-lock.yaml` does not list `dialkit@^1.4.3` and `motion@^12.43.0`, which `package.json` does. Installed with `pnpm install --no-frozen-lockfile` and restored `pnpm-lock.yaml` with `git checkout` (not committed). `ffmpeg-static`'s postinstall is blocked by pnpm's build-script policy, so its binary was fetched by running its `install.js` by hand.
- `npx playwright install --with-deps chromium` worked. Real Google Chrome could not be installed: `npx playwright install chrome` got `CONNECT tunnel failed, response 403` from the proxy. `scripts/verify/lib/browser.mjs` pins `channel: "chrome"`, so for this container only `/opt/google/chrome/chrome` is a symlink to Playwright's Chromium 141.0.7390.37. Not committed, nothing in the repo changed for it.
- The renderer is SwiftShader (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))`); `--use-angle=metal` does nothing on Linux. DISPATCH warns SwiftShader can pause rAF; the export gates drive frames by `await`, not rAF timing, and every browser number below is compared with the same gate's own run on the unchanged base (`52982e8`, a worktree served on :3139), never with Mac numbers.
- tsc baseline measured: 6 errors (5 in `lib/geometry-engines.ts`, 1 in `lib/dd-engine/handFeel.ts`).

## Step 1 · Animated GIF (coverage row 94)
Built:
- `lib/export/gif.ts`: GIF89a writer (LZW, NETSCAPE2.0 loop, changed-rectangle frames with disposal 1, one GIF frame per planned frame even when nothing changed), `buildInkPalette` (one palette for the whole film from 12 sampled frames, paper and ink core reserved exactly, median cut weighted by the square root of the count so the anti-aliased ramp gets its steps), `PaletteMapper` (nearest colour, luma-weighted, NO dithering so the paper never takes specks), `gifDelaysCs` (each instant rounded, so the sum is the plan's length to the centisecond; 30 fps gives 3/3/4 cs), `GIF_MAX_FPS = 50` (browsers play delays under 2 cs as 10 cs).
- `lib/export/encoders.ts`: `GifEncoder` (writes one frame behind, so each delay is cut from the next frame's own timestamp) and an optional `samplesWanted`/`sample` hook on `AnimationEncoder`.
- `lib/export/recorder.ts`: a sampling pass for an encoder that asks for one (first and last planned instant always, rest spread; rendered through the same seek, clock, grab and ground as the main loop). The crop-and-ground step is now one `normalize` function both passes use. Nothing changes for WebM or APNG (they ask for no samples).
- `lib/export/index.ts`: `format: "gif"`; a GIF is always on paper (one-bit transparency would fringe every soft edge) and is planned at `min(fps, 50)`; both say so in the result's warnings when they apply.
- `components/viewport-3d.tsx`: a GIF button in the export bar between Video and GLB. It shares Video's render path, one-at-a-time guard, cancel and panel settings (clock, frame rate, resolution); `handleExportVideo` became `runAnimatedExport(kind)` with `handleExportVideo`/`handleExportGif` as the two entries. The Video panel says GIF uses its settings. Filenames `<name>_<mode>_anim_<stamp>.gif`.
- Gates: `scripts/verify/assert-export-gif.mjs` (node) and `scripts/verify/assert-export-gif-app.mjs` (browser). Helpers: `scripts/verify/lib/gif-walk.mjs` (independent block walker), `lib/ts-mutant.mjs` (in-process known-bad builds, text edit must match exactly once or it throws), `lib/export-app.mjs` (open app, draw, click, catch download, ffmpeg frame reads).
- `assert-export-live.mjs` and `assert-export-window.mjs` serve `lib/export` to the page from a fixed module list; `gif` was added to both lists, or `index.js` would fail to import in those gates. No row or bar changed.

Checks at the step 1 commit (browser gates are added in the step 2 commit's log once they finish):
- tsc: 6 errors, the baseline (5 `lib/geometry-engines.ts`, 1 `lib/dd-engine/handFeel.ts`).
- `assert-export-gif.mjs` (node): 8 PASS · 0 FAIL. Every row paired with a known-bad that fired: a copy cut to 60% (decoded 36 of 79 frames, not clean); a writer that drops unchanged frames (61 of 79, the plan has 19 hold frames); a writer that widens LZW codes one step early (film decodes exactly because paper runs keep the table under 512 codes, so the row also writes a table-filling noise frame: 112956 channel values wrong); a uniform 6x7x6 palette (33780 paper pixels wrong, ink mean 11.67); Floyd-Steinberg on the same palette (5277 specks; ours 0); gap-by-gap delay rounding (237 cs vs 263); the same plan at 60 fps (52 of 157 delays under 2 cs); loops = 3. Film: 6513 distinct source colours into 256, ink mean error 1.846 levels on the last frame, 0 paper pixels wrong.
- `assert-export-encoders.mjs` (node): 8 PASS · 0 FAIL, same as base. `assert-export-plan.mjs` (node): 12 PASS · 0 FAIL, same as base.
- Step 1 browser gates, run on the step 1 tree (:3138) after that commit, each compared with its own run on the unchanged base (:3139): `assert-export-gif-app` 9 PASS · 0 FAIL (new; 74 planned frames = 74 GIF frames by the walker and by ffmpeg, 798x1182 = the live PNG's even size, first and last frames vs the app's own 1x PNG: 0 paper px wrong, ink mean 0.899 and 1.016 levels; controls: a copy cut to 60% decodes 36 frames not clean, 61 distinct frames against 74 planned, last frame vs live mid-draw 4562 paper px wrong, whole-gap delay rounding 296 cs vs 308). `assert-export-live` 9/0 (base 9/0). `assert-export-app` as written crashes with ENOBUFS after 15 PASS on both trees (base: 73 frames, here: 84); with only its ffmpeg buffer raised it is 21 PASS · 2 FAIL on both trees, the same two rows (see step 2). `assert-still-export` 10 PASS · 1 FAIL on both trees (row 8, console clean, the proxy's ERR_TUNNEL).
## Step 2 · Transparent video, WebM with alpha (coverage row 96)
Built:
- Measured first: this Chromium's `VideoEncoder` refuses `alpha: "keep"` (`isConfigSupported` false for VP8 and VP9; `configure` throws "Alpha encoding is not currently supported."). So the alpha is a SECOND opaque VP9 stream whose luma is the alpha, which is how WebM carries alpha anyway.
- `lib/export/webm-alpha.ts`: `rgbaToI420Pair` builds both frames as I420 buffers: colour in BT.601 limited range with chroma averaged weighted by alpha (so transparent black does not darken an edge), alpha written straight into Y (a canvas would push it through limited range and transparent paper would come back at alpha 16).
- `lib/export/webm.ts`: `WebmMuxer({ alpha: true })` writes `AlphaMode = 1` in the track's Video element and every frame as a BlockGroup: Block, ReferenceBlock on inter frames, BlockAdditions/BlockMore/BlockAddID 1/BlockAdditional. Layout copied from ffmpeg's own alpha WebM (walked, not guessed). With `alpha` off the output is unchanged (`assert-export-encoders` still 8/0).
- `lib/export/encoders.ts`: `WebCodecsWebmAlphaEncoder` (two `VideoEncoder`s, chunks paired by timestamp, a Block is a keyframe only when both halves are) and `pickWebmAlphaCodec`. The alpha stream is LOSSLESS where the browser allows it: VP9 `bitrateMode: "quantizer"`, quantizer 0. Measured: at the colour bitrate an empty keyframe's alpha came back with 1261 px at alpha 1 to 3 spread from the top-left corner (a veil); quantizer 0 decodes exactly and the file was about the same size (93095 vs 91100 bytes). VP8 has no per-frame quantizer, so a VP8-only browser keeps a bitrate-coded alpha and the result says so.
- `lib/export/index.ts`: `format: "webm-alpha"` (implies transparent). No WebCodecs or no VP8/VP9 encoder: falls back to APNG with the warning "This browser cannot encode WebM video, so the transparent export is an animated PNG instead. It keeps the same see-through ground." A plain `webm` request with `transparent` still gets APNG, as before. `alphaCoding: "bitrate"` is the parked prior for the gate.
- `components/viewport-3d.tsx`: under Background, Transparent now shows WebM | APNG (WebM default) in the existing Video panel; the note says where each plays. Dev law `window.__fsExportAlphaCoding = "bitrate"` parks the lossy alpha.
- Gates: `scripts/verify/assert-export-webm-alpha.mjs` (node), `scripts/verify/assert-export-webm-alpha-app.mjs` (browser), helper `scripts/verify/lib/ebml-walk.mjs` (independent WebM walker). `webm-alpha` added to the module lists in `assert-export-live` and `assert-export-window`.
- `assert-export-app.mjs`: its APNG rows now pick APNG by name after Transparent (the default container changed), and `decodeRgba`'s ffmpeg buffer went from `1 << 28` to `2 ** 31`: at this page size a Rod film is 3.77 MB a frame, so 71 frames filled it and the gate died with ENOBUFS before its APNG and clock rows ran (on the unchanged base too). No row or bar changed.
- `lib/export-app.mjs` gained `frameHashes` (one streaming decode instead of one decode per frame); `assert-export-gif-app` uses it. Same rows.

Checks at the step 2 commit (browser gates run on a clean worktree of this commit, :3142, with the export-app buffer change applied the same way as the base comparison):
- tsc: 6, the baseline.
- `assert-export-webm-alpha.mjs` (node): 4 PASS · 0 FAIL. Paired known-bads that fired: a muxer that drops the BlockAdditions (decodes differently from ffmpeg's file); the same frames muxed without `alpha` (AlphaMode 0, 0 alpha payloads); an alpha plane written through limited range (38380 alpha values wrong on the last frame, 1956736 veiled px over 55 frames, worst alpha 16). Our mux of ffmpeg's own VP9+alpha frames decodes byte-identical to ffmpeg's file. ⚠ One bar here is RELATIVE and says so: opaque ink after 4:2:0 must be no worse than ffmpeg's own RGBA to yuva420p conversion of the same frames (ours 2.185 levels, ffmpeg 2.279). I first wrote it as an absolute 2 levels; ffmpeg's own conversion misses that on this film, so 2 is below what 4:2:0 allows. Owner's call whether the relative bar stands.
- `assert-export-webm-alpha-app.mjs` (browser): 10 PASS · 0 FAIL. 132 planned frames, 132 Blocks each with alpha, 798x1182 = the live PNG's even size, libvpx decodes all cleanly; last frame 99.2% alpha 0 with 6717 opaque px (ffmpeg's native vp9 decoder, which ignores alpha: 0.0%, the control); first and last frames vs live transparent PNG: 0 veil px, 43.56 dB and 44.76 dB (mid-draw control 24.16 dB, 4620 veil px); lossless vs the parked bitrate alpha: 0/0 veil px vs 1261/64; Chrome's own `<video>` plays it 99.2% alpha 0 (the same bytes with AlphaMode patched to 0: 0.0%); with `VideoEncoder`/`VideoFrame` deleted from the page the same press writes an APNG and the toast carries the fallback sentence (the WebM run's toast does not).
- Regression, all equal to the same gate on the unchanged base: `assert-export-encoders` 8/0, `assert-export-plan` 12/0, `assert-export-gif` 8/0, `assert-export-gif-app` 9/0, `assert-export-live` 9/0, `assert-export-app` 21 PASS · 2 FAIL (base 21 · 2; the same two rows: the stall row, fast 55.0 s vs slow 54.7 s here, 43.3 vs 50.0 on base, where SwiftShader's frame time swamps the 90 ms stall; and console errors, `net::ERR_TUNNEL_CONNECTION_FAILED` from this container's proxy), `assert-still-export` 10 PASS · 1 FAIL (base the same; row 8 "console clean", the same proxy error).

## Step 3 · Animated GLB of the draw-in (coverage row 92)
What three's GLTFExporter can animate: node TRS and morph target weights (no visibility channel; `KHR_animation_pointer` is not written). A pen reveal happens inside a stroke, so it is written as MORPH TARGETS whose weights are keyed on every frame of the Video panel's frame plan.
Built:
- `lib/export/drawin-glb.ts` (pure): every vertex is matched to the pen's path (the engines' `strokeTo3D` mapping, with the export's unknown recentre offset recovered by a translation-only fit to the centrelines); the app's own reveal spans per frame decide what is hidden; each morph target is one reveal state; weights blend between stored states over the sequence of CHANGES, so a pen lift or the hold stays still (the first build blended over frames and the mark crept through a 23 s lift the live view sat still for; the browser gate caught it: 779 distinct weight rows of 779). The base pose is the finished mark, so a viewer that ignores animation shows the static GLB. Where a hidden vertex goes: whole mesh hidden, one point; a one-stroke mesh (Rod, Extrude, dd engine, or a mesh inferred to hold one stroke), the visible edge nearest it, which draws a tip at the pen; a fused mesh (Solid), un-indexed and split so no edge exceeds 1/60 of the canvas's long side, each corner shown when any stroke that covers it is shown, a hidden triangle folded to the pen's front on its own stroke, a straddling one folded to the edge only within its own longest edge (no spikes). Budget: 24 targets per mesh, fewer if the dense bytes pass 48 MB.
- `lib/export/drawin-glb-three.ts`: the three adapter (the only `lib/export` file that imports three; NOT re-exported from `index.ts`, because `assert-export-live`/`-window` serve the film modules to a page as standalone ES modules). One clip, `draw-in`, LINEAR, one keyframe per planned frame.
- `lib/export/glb-sparse.ts` (pure): rewrites morph targets as glTF sparse accessors after GLTFExporter (which writes them dense) when under three quarters full. Two-stroke exports, measured: Solid 52.8 MB with dense targets and the first, finer split, 9.3 MB final; Inflate 30.6 MB before its per-stroke meshes were recognised, 4.4 MB final; Extrude 1.9 MB; Rod 1.26 MB (static about 0.2 MB).
- `components/viewport-3d.tsx`: an Anim GLB button right after GLB in the export bar. `Scene` publishes `DRAWIN_EXPORT.spansAt(playhead, opening)` built from the same calls the live rebuild path cuts Solid and Extrude at (`revealDistanceFraction`, `windowAt`, `windowParts`, `strokeSpansIn`, or `takeSpansIn` under a timed take). `buildExportResult` is now the one engine export both GLBs build from; `filmPlanInput` is the one plan input the Video panel sentence and the GLB share (behaviour of the sentence unchanged). Dev law `window.__fsAnimGlbReveal = "off"` parks a GLB that ignores the reveal (the whole mark on every frame), the browser gate's known-bad.
- Gates: `scripts/verify/assert-export-glb-anim.mjs` (node: a Rod-like two-tube export and a fused one through the real adapter and GLTFExporter), `scripts/verify/assert-export-glb-anim-app.mjs` (browser: Rod, then Solid), helper `scripts/verify/lib/glb-walk.mjs` (independent GLB reader, sparse accessors included). Both read the file twice: with the independent reader and with three's GLTFLoader + AnimationMixer, which is what a three-based GLB viewer runs.
- Looked at, not gated: I rendered Inflate, Solid and Extrude exports at 0, 30, 55 and 100% of the clip in headless three while building (scratch only, not committed, not for the owner). That is how the hairline wedge, the crossing notch and the blend lattice were found; the gates for each came after.

Checks at the step 3 commit (browser gates on the final tree, :3138):
- tsc: 6, the baseline.
- `assert-export-glb-anim.mjs` (node): 11 PASS · 0 FAIL. Known-bads that fired, each a real earlier build or a named break: a copy cut to 60% (unreadable); distinct weight rows 27.5 per channel against 41 planned (a coalescing writer's count); the first keyframe's bounds against the static's; the previous build that folded a hidden mesh vertex by vertex (first keyframe drew 2.147e-4 of the mark's area, ours 1.567e-14); a build that hides what should show (area shrinks); the centreline offset left at 0 (mean fit distance 0.089 against 0.024, tube radius 0.04); on a fused mesh, the previous build left indexed and unsplit (hidden-triangle area 2.15e-4, ours 7.5e-14; front corners never beyond their triangle's longest edge); the mixer's mid-take weights against the first; per-stroke inference switched off (both meshes named `inflate_00x` get un-indexed into 12528-corner soups instead of staying indexed); a sparsifier that drops each target's last entry (26 of 35 targets sparse, decoded by our reader AND three's GLTFLoader to exactly the dense values); the previous build's frame-index blending through a 20-frame pen pause (21 distinct weight rows against 1).
- `assert-export-glb-anim-app.mjs` (browser): 11 PASS · 0 FAIL. Rod, two strokes, 459 planned frames at 24 fps = 459 keyframes on both channels at the plan's times (79.5 distinct rows per channel); last keyframe bounds = the static GLB's; first instant: live draws 21 ink px (Rod's one-ring start dot, 0.48% of the 4421 at the end, see question 3), the GLB's first keyframe area 1.4e-15 of 0.1606, the last keyframe equals the static GLB to 0 (the parked known-bad, the whole mark every frame, has first-keyframe area 0.1606); area only grows, 67.2% at mid-take; three's AnimationMixer binds both tracks and puts the file's weights on the meshes exactly at the first and last keyframes; Solid (one fused mesh, 43998 corners from 20034): first keyframe no area, last keyframe the static Solid GLB's surface (area 0.78437 both, bounds equal), no hidden triangle drawn at any stored state, known-bad first area 0.7844.
- Regression, each equal to its own run on the unchanged base: `assert-export-webm-alpha` 4/0, `assert-export-webm-alpha-app` 10/0, `assert-export-gif` 8/0, `assert-export-gif-app` 9/0, `assert-export-encoders` 8/0, `assert-export-plan` 12/0, `assert-export-live` 9/0, `assert-still-export` 10 PASS · 1 FAIL (row 8, the proxy's ERR_TUNNEL, as on base), `assert-export-app` (with the fix commit `b038238`) 21 PASS · 2 FAIL, the same two rows as base (stall row: fast 55.8 s vs slow 61.6 s here; console: ERR_TUNNEL). A first run of `assert-export-app` beside two `assert-export-window` runs timed out waiting for its second download after 300 s; run alone it completed as above.
- `assert-export-window.mjs`: see "assert-export-window, base and final" below.

## Review fixes (after an independent read of the diff)
A subagent read the whole `lib/export` and viewport diff for correctness. It found no broken file on the normal paths; six points were fixed in one commit:
- `drawin-glb.ts`: the centreline grid's cell now has a floor (1e-3 units). A one-tap drawing (every point in one place) made cells 1e-7 wide, and `nearest` could walk thousands of empty rings, a hang.
- `glb-sparse.ts`: an all-zero morph target stays dense (the spec requires `sparse.count` of at least 1).
- `encoders.ts`: the alpha `VideoFrame` is built inside the `try`, so the colour frame is closed if it throws.
- `index.ts`: the lossy-alpha warning no longer blames VP8 alone (a VP9 encoder without quantizer mode takes the same path).
- `viewport-3d.tsx`: the GIF button stays a GIF under the dev law `__fsExportGround = "none"` (it wrote a WebM).
- `webm.ts`: DocTypeVersion 4 when the file carries BlockAdditions and AlphaMode, as libwebm writes it; 2 otherwise (the no-alpha output is unchanged byte for byte, `assert-export-encoders` 8/0).
Node gates after the fixes: `assert-export-webm-alpha` 4/0, `assert-export-encoders` 8/0, `assert-export-glb-anim` 11/0, `assert-export-gif` 8/0, `assert-export-plan` 12/0; tsc 6. Browser gates rerun on the fixed tree: `assert-export-webm-alpha-app` 10/0 (Chrome still plays the DocTypeVersion 4 file see-through), `assert-export-glb-anim-app` 11/0, `assert-export-gif-app` 9/0. `assert-export-window`: see its own section below.

## assert-export-window, base and final
Run alone, one after the other, 4-hour timeout each, on this container's Chromium: unchanged base (`52982e8`, :3139) 38 PASS · 1 FAIL; final tree (the review-fix commit plus its LOG commit, :3138) 38 PASS · 1 FAIL. The one failure is the same row on both, "no console errors across the run", from the proxy's `net::ERR_TUNNEL_CONNECTION_FAILED`. Every other row, its paired controls included, passes on both. Each run took over an hour.

## What I could not run, and why
- Real Google Chrome: the proxy refuses its download (403). Every browser number here is Playwright's Chromium 141 on SwiftShader, through a container-only symlink at `/opt/google/chrome/chrome`, compared with the same gate's run on the unchanged base in the same container. None of it is a Mac number.
- `assert-export-window.mjs` per step: one run takes well over 50 minutes here (the base run timed out at 50 minutes on 19 PASS and 0 FAIL), so it was run on the base and on the final tree only, each alone with a long timeout: 38 PASS · 1 FAIL on both, the same row.
- Playback outside Chrome: Safari and Firefox are not in this container, so where the transparent WebM plays see-through outside Chrome and Edge is unverified; the panel says "other players may show it without its alpha". GLB viewers other than three (Blender, Babylon, model-viewer) were not run; the animated GLB is held to an independent reader and to three's GLTFLoader + AnimationMixer.
- The VP8-only branch of the transparent WebM (lossy alpha, with its warning) was not exercised: this Chromium has VP9. The no-WebCodecs fallback WAS exercised, by deleting `VideoEncoder` and `VideoFrame` from the page.
- `pnpm install --frozen-lockfile` (see Setup). `pnpm lint`: the snapshot has no ESLint config (flat or legacy), so eslint exits at startup, on base too.

## A mistake of mine, fixed
Step 2's commit (`998f74f`) shipped `assert-export-app.mjs` with the `const buf = execFileSync(...)` line of `decodeRgba` deleted by my own edit, so that gate did not parse at that commit. The step 2 checks above ran the pre-amend tree plus a buffer-raised copy, not the committed file, which is why it was missed. Fixed in its own commit after step 2; its run on the final tree is below.

## Questions for the owner
1. Transparent video: the Video panel's Transparent now offers WebM (VP9 alpha, the default) or APNG. Should WebM be the default? `assert-export-app` now picks APNG by name for its APNG rows.
2. `assert-export-webm-alpha` holds opaque ink after 4:2:0 to "no worse than ffmpeg's own conversion" (ours 2.185 levels, ffmpeg 2.279). My first bar was an absolute 2 levels, which 4:2:0 cannot meet on that film. Keep the relative bar?
3. Live Rod at playhead 0 draws one ring of the first stroke (21 px, 0.48% of the mark) on the identity path, because a stroke counts as started at `t == tStart`. Under a non-identity schedule the same instant is empty, and so is the animated GLB's first keyframe. Is the dot intended, or a boundary quirk? `assert-export-glb-anim-app` bounds it rather than hiding it.
4. GIF: always on paper, at most 50 fps, shares the Video panel's settings, button right after Video. OK?
5. Anim GLB: the button label, the Video panel's clock as its keyframes, 24 morph targets per mesh with a 48 MB dense budget, fused meshes split to 1/60 of the canvas. Two-stroke sizes: Rod 1.26 MB, Extrude 1.9 MB, Inflate 4.4 MB, Solid 9.3 MB. On Solid and fused Inflate a small nick shows where two strokes' merged surface is not drawn yet, and a blended frame can show a faint seam. Acceptable, or should the GLB carry fewer frames and more states?
6. `pnpm-lock.yaml` does not match `package.json` (`dialkit`, `motion`), so a frozen install fails on this snapshot.

# ANIM-1A3 lane log, 2026-09-25

Stopped at the 150k lane context gate (hook) after the code steps. Nothing browser-verified yet: no dev server was started, no browser was opened, no gate was run.

## Committed on lane/anim1 (on top of a6e2d2ea5)
- 968cf60f6 WIP finished and compiling. Scene builds `timed` with `buildTimedSchedule(schedule, take with knockout applied, { baseMs: computedDuration, pace: paceFromCurve(c => revealDistanceFraction(strokes, c, revealMode, hybridBlend, lifts)) })`. The whole-take ease is NOT inside the pace: the frame loop compares the eased playhead to the keys, so with neutral rows `key <= playhead` is the shipped `beat <= rdf(playhead)`. Scene hands it up by `onTimed`; host `totalDuration = takeMs ?? penMs`; export, plan note and `getTotalDuration` read `exportMs` (= totalDuration, or penMs under the `exportpen` knockout). Local `easeReveal` deleted, re-exported from stroke-timing. Slope `DataTexture` (RedFormat, FloatType, nearest) and `slopeMax` on the tip field entry; a timed bake with no slope array throws.
- cca362475 Shader: `fsTsl = uFsTipSlopeOn > 0.5 ? texture2D(uFsTipSlope, fsTuv).r : 1.0`; back and taper times fsTsl; fsTsd and the trailing fsBsd divided by max(fsTsl, 1e-6). Under timed, tScale = 1 and slopeOn = 1 unless knockout "slope". Diag readout adds `slopeOn` only when on. Host `window.__fsTake = { set(rows, {ripple}) -> bool, get(), clear(), knockout(name) -> bool }`. Knockouts: slope, clock, speed, delay, holdBack, ease, exportpen (speed/delay/holdBack/ease zero that field of every row before the build). `get().live.meshes[i] = { mode, visible, start, count, total }` is read off each mesh's geometry drawRange at the END of the frame loop (module `TAKE_LIVE`, one per page, read with compare off).
- bf12c4867 `lib/doc-store.ts`: `take` in SessionDoc, `readTake` drops unreadable rows and names each in repairs, default STROKE_TIMING_TAKE_DEFAULTS. `app/page.tsx`: state, docRef, applyPatch, `handleTakeChange` (whole take, one undo step "Stroke timing"), restore, save + deps, wrapper props. Motion presets leave the take alone.
- tsc: 6 errors after each commit, the baseline.

## Left, in order
1. Start the dev server on :3138 from this clone (`scripts/verify/lib/dev-server.mjs` or `npx next dev -p 3138`), record the pid, confirm `lsof -p <pid> | grep cwd` is this clone, kill by exact pid only.
2. Smoke: headless, one browser through `scripts/verify/lib/browser.mjs`. Draw the hero word on Rod, `__fsTake.set({1:{delayMs:0,speed:2,ease:{kind:"preset",id:"linear"},holdBack:false}})`, confirm `get().timed` and that `live.meshes[1].count` moves. Watch for a pageerror from the slope throw.
3. Write `scripts/verify/assert-stroke-timing-browser.mjs` (Rod and Inflate only). Expectations from a no-rows live measurement of `live.meshes[i].count/total` over a playhead sweep, never from `get().slots`. Checks + must-fail knockout: speed (speed), delay (delay), hold back (holdBack), ease (ease), nose at speed 2 (slope; compare nose length in px against speed 1), identity no rows byte-identical to 1051bc8e1 with a 1 ms delay row as positive control, export matches live twice (exportpen; plan vs harness drive as in assert-export-window `film()`). Extrude and Solid under a timed take print NOT WIRED (they rebuild through `filterStrokesBySchedule`), never a pass.
4. Run it plus assert-take-timeline 20/20, assert-drawin-timing 25/25, assert-export-window 39/39, assert-stroke-schedule 57/60. Then `git checkout` every committed artefact the gates rewrote.
5. Film the hero word on Rod: stroke 5 held back, stroke 2 at speed 0.5. Open 4 frames, write what was seen, name every PNG path.
6. RUN-QUEUE F118 dated ANIM-1A3 note.

## Open questions for the next lane
- Rod under timed reads `sampleTake` spans and ignores the per-stroke point timelines (Authentic pacing inside a stroke comes only through the pace table). Check that a neutral-row take does not change Rod's frames; if it does, that is the identity check's positive-control arm catching it.
- The inflate drawRange margin under timed uses `slopeMax` word-wide. Conservative, not exact.

## Baselines (before, head 1051bc8e1, :3138, headless)
- assert-take-timeline 20/20 · assert-drawin-timing 25/25 · assert-export-window 39/39 · assert-stroke-schedule 57/60 (3 known reds) · tsc 6

# ANIM-1A4 lane log, 2026-09-25

## Step 1 · smoke, :3138 (pid 11304 parent, 11316 listener, cwd this clone)
- Hero word (`scripts/capture/logo-strokes.json`, 12 strokes) injected through `__styleHarness.injectStrokes` (12 ms/pt, 60 ms gap), `setMode("rod")`, playhead 0.75.
- `__fsTake.set([{stroke:5, holdBack:true}])` as written in the brief is REFUSED: `set` takes `{index: full row}` and `rowOk` needs delayMs, speed, holdBack and ease. `set({5:{delayMs:0,speed:1,holdBack:true,ease:linear}})` returns true.
- With the row: timed true, takeMs 14883.6 vs penMs 13116, stroke 5 slot moves to 13116..14883.6. Live: mesh 5 count 9600/9600 -> 0/9600; mesh 8 2976 -> 6816 (full), mesh 9 0 -> 3360. No pageerror.
- Seen: no-rows frame reads "Desk Dooc" (the D, two o's, part of the next o). Held-back frame reads "Desk  oodl": the capital D of Doodle is missing and the letters after it run further. `docs/verification/stroke-timing/smoke/rod-norows-p075.png`, `rod-hold5-p075.png`.

## Step 2 · gate written, first run (Rod only reached), STOPPED AT THE 100k CONTEXT GATE
`scripts/verify/assert-stroke-timing-browser.mjs`, run log `docs/verification/stroke-timing/run1-lane.log`. 5 PASS · 7 FAIL. Read the fails as follows, gate first:
- PASS with must-fail firing: speed (Δ 0.010, knockout 0.380), delay (0.000, knockout ink 0.130 at s+200), export matches live twice (122/122, 122/122; knockout exportpen 8/107 at 13116 of 14883.6 ms).
- rod 3 hold back, GATE BUG: I expected the take to grow by the LIVE ink window (1683.2 ms); it grows by the stroke's pen slot (1767.6 ms). Ink starts ~12 ms after the slot and ends ~72 ms before it. The render parts passed (ink 0 at own midpoint, knockout 0.51; Δ 0.010 after the rest). Replace the growth test with a bisected live window under the row: e'-s' within 2% of d, s' >= pen, takeMs >= e'.
- rod 4 ease, GATE BUG, same cause: u was measured on the live ink window, the ease runs on the slot. Worst Δ 0.040 at u=0.8, knockout 0.390. Fix: anchor on the render, S0 = 2*s2 - s from the speed-2 row's bisected first ink; the slot length still needs a render source.
- rod 5 nose, CANNOT FAIL on Rod: 3 px with slope, 3 px with slope knocked out. The slope texture is Inflate's tip shader; Rod does not read it. Grade the nose on Inflate only, print Rod as NOT APPLICABLE.
- rod 6a NOT RUN: base file missing. Next: `git worktree add /Users/sebs/.fs-lanes/anim1-base 1051bc8e1`, symlink node_modules, stop :3138 (lane), start the base on :3138, run `--phase=base` (copy the gate file into the worktree first, it does not exist at 1051bc8e1), stop it, `git worktree remove`, restart the lane.
- rod 6b REAL FINDING, the LOG.md risk confirmed: twelve neutral rows (timed=true, takeMs 13116) change 1 of 25 frames against no rows. Not yet localised to a playhead; add the index to the detail.
- rod 6c positive control did not fire: a 1 ms delay left the frame at the bisected first ink byte-identical. Bisection lands on `hi` (first ink); 1 ms is under one ring segment there. Use the frame 0.5 ms after first ink across all 12 strokes, or 1 ms on every row.
- INFLATE NOT REACHED: `live.meshes` reports 1 mesh (mode inflate) for 12 strokes. The fused inflate is one mesh, so per-stroke drawRange cannot grade it. Needs a render instrument that is not TAKE_LIVE (pixel diff against the no-rows run per region), or a per-stroke reach readout on the inflate path.
- Extrude and Solid print NOT WIRED (timed=true), as briefed.
- Not done: step 3 baselines, step 4 film, step 5 note in RUN-QUEUE. No change made to components/viewport-3d.tsx.
- Dev server :3138 was pid 11304 (listener child 11316), killed by exact pid at the stop.

# ANIM-1A5 lane log, 2026-09-25 (stopped at the 150k lane context gate)

## Committed
- 918f858a9 viewport: Rod per-stroke pen clock under a timed take (`timedRodMs`), see RUN-QUEUE F118 ANIM-1A5 note. Gate: `--rows=`, `--engines=` in lane phase, 6b names frame and stroke, 6c delays every row 1 ms at a render-found ring step.
- 45dbb7a04 gate: slot from the render (B0 from speed-2 half reach, length from the ripple shift of stroke 6), hold back and ease re-graded; Inflate pixel masks; Rod row 5 NOT APPLICABLE.
- last commit: Inflate levels (LV0 2%, LV1 98%, NONE 0.5%), BG read at 100 ms, `FS_TAKE_WAIT_MS` (6000 changed nothing, so not a bake race), `--profile`, `FS_MASK_DUMP`.

## Measured
- Rod rows 1,2,3,4,6b,6c PASS with knockouts firing (numbers in the RUN-QUEUE note).
- Inflate rows 1 to 5 FAIL. Neutral rows vs no rows differ at the D's stem top from 6975 to 7475 ms, anchored to the clock (a 400 ms delay on stroke 5 does not move it). Frames: scratchpad only, not kept. Reproduce: `FS_MASK_DUMP=<dir> FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-stroke-timing-browser.mjs --engines=inflate --rows=none --profile`.

## Left, in order
1. Inflate: find why the stem-top region of stroke 5 inks at a fixed clock time under a timed take (fused triangle keys at the loop closure under `timedArc`, or the tip field under `timedTipMap`). Run `--engines=inflate --rows=6` first: 6b will show whether neutral rows change Inflate frames.
2. Once Inflate's neutral profile matches no rows, re-run Inflate rows 1 to 5. Row 1's expectation anchors on first ink; on Inflate B0 sits about 165 ms before first ink, so row 1 may need f(T) = g(B0 + 2(T - B0)).
3. Step 3: base worktree `/Users/sebs/.fs-lanes/anim1-base` at 1051bc8e1, `--phase=base`, then 6a on Rod and Inflate, then `git worktree remove`.
4. Step 5 baselines on this head: take-timeline 20/20, drawin-timing 25/25, export-window 39/39, stroke-schedule 57/60. `git checkout` any artefact they rewrite.
- tsc: 6 errors after the viewport change, the baseline.
- Dev server :3138 was pid 56191 (listener 56213, cwd this clone), killed by exact pid.

# ANIM-1A6 lane log, 2026-09-25 (stopped at the 150k lane context gate)

## Committed
- Rebased onto main 466d1e7bd (no force; conflicts kept both features, see RUN-QUEUE F118 ANIM-1A6 note). tsc 6, node gate 16/16, 12/12 mutants.
- 87591348e viewport + stroke-timing + pen-reveal: `timedFront` (cull front per stroke in arc), `TimedSchedule.identity` routes an identity take to the shipped path, tip bake return-pass gap in raw arc under a timed map.

## Measured
- Break that named the layer: timed margin at slope 1 instead of slopeMax moved the stem-top region from 400 ms early to 50 ms late. Keys ascending both ways; bypassing the sort changed nothing.
- Inflate: R0, 4, 5, 6b, 6c, 7 PASS. 1 FAIL 0.0831, 2 FAIL 0.0595, 3 FAIL 0.0595. Log: scratchpad only.

## Left, in order
1. Gate row 1: sample at T = B0r + (s + u·d - B0r)/2 (B0r is already computed from the render). Rod should still pass.
2. Gate rows 2 and 3: the stroke-K mask counts stroke 6 ink in the overlap once K moves past stroke 6's start. Check the mask-exclusion claim at line ~152 ("pixels two strokes share are in neither mask") against a frame: dump with FS_MASK_DUMP at s+400+0.9d under delay 400. If the overlap is real ink from stroke 6 in pixels only stroke K's mask holds, build the mask from the frame where K is held back and every other stroke is whole (subtract that), and re-run.
3. Step 3: base worktree /Users/sebs/.fs-lanes/anim1-base at 1051bc8e1, --phase=base, 6a on Rod and Inflate, git worktree remove.
4. Step 4 baselines: take-timeline 20/20, drawin-timing 25/25, export-window 39/39, stroke-schedule 57/60. git checkout any artefact they rewrite.
5. Rod was not re-run after the rebase or after 87591348e. Run --engines=rod first.
- Dev server :3138 was npm pid 30422, next-server pid 30474 (cwd this clone), killed by exact pid.

# ANIM-1A7 lane log, 2026-09-25

## Committed
- Rebased onto main b23944506, no conflicts, leak-fix lines all present. tsc 6, node gate 16/16, 12/12 mutants.
- b8bbd6a1f gate row 1 from B0r. e19902e01 Inflate mask needs ink in a k-alone frame, plus `--overlap` diagnostic. 4b2c62dc6 base grid and full run. b11b1a891 baselines. 8b4395b66 RUN-QUEUE F118 note.

## Measured
- Full run on this head: 20 PASS 0 FAIL, Rod and Inflate, 6a 25/25 on both. Baselines 20/20, 25/25, 39/39, 57/60 (same 3 rows as travel/gates-before).
- Rows 2 and 3 were the mask: 88 px at the D's stem top are stroke 5's surface on stroke 6's front. Frames in docs/verification/stroke-timing/anim1a7-overlap/.

## Left
- Nothing for Rod and Inflate. MERGE-READY. Extrude and Solid are not wired under a timed take.
- Row 3 on Inflate passes at 0.0175 of a 0.02 bar. If it flakes, look there first.

# ANIM-1B lane log, 2026-09-25

## Committed
- 3fc86f18f the strip (`components/stroke-strip.tsx`), the stroke block in `draw-in-timing-controls.tsx`, provider and gesture bracket in `app/page.tsx`, `rowOf`/`withRow`/`withoutRow`/`penMsOf` in `lib/stroke-timing.ts`. tsc 6, baseline 6.

## Left, in order
1. Start the dev server on :3138 from this clone (`next dev -p 3138`), record its pid, check its cwd, kill by that pid.
2. Write `scripts/verify/assert-stroke-strip.mjs` on the pattern in `assert-stroke-timing-browser.mjs` (`chromium` from `lib/browser.mjs`, `__styleHarness.injectStrokes`, `__revealHarness.setProgress`, `__captureHarness.grab`, `__styleHarness.undo`). Rows: body drag N px gives delay N*axisMs/W (read `data-axis-ms`, ease linear) and the picture changes at a playhead inside the shift; end drag changes speed; Ripple on moves later `data-t0` and off does not; undo gives back `__fsTake.get().take` exactly; `[data-take-notice]` on Extrude and Solid; no drag leaves the take empty and the grab identical to main. A must-fail for each (e.g. `__fsTake.knockout("delay")`, or a sabotage env).
3. Check strip `data-t0/t1` against `__fsTake.get().slots` to 1 px.
4. Screenshot at 1512x982 and 2x, open both, write what was seen.
5. Run `assert-take-timeline.mjs`; in group mode the strip is now per stroke.

# ANIM-1B2 lane log, 2026-09-25 (stopped at the 150k lane context hook)

## Committed
- 0b927b1d5 strip: selected bar outlined (its old grey matched a finished bar), grips 2x6 with mix-blend-difference. Grabs in docs/verification/stroke-strip/.
- e8a3f6e26 `scripts/verify/assert-stroke-strip.mjs` 18/18 with controls, `base-3a211a36d.json`, `run-lane.log`.
- RUN-QUEUE F118 ANIM-1B2 note (this commit).

## Measured
- assert-take-timeline: 20/20 on main 3a211a36d (same session), CRASHES on the lane after A1. Its `strip()` reads `[role=img]`; the new band is `role=listbox`. The gate is out of date for `/`, the strip is right. F1 and F2 test the voided read-only view.
- Base: a full worktree of main is 8.1 GB (tracked docs/ is 8.4 GB). Use `git worktree add --no-checkout`, `sparse-checkout set --no-cone '/*' '!/docs/'`, and `cp -cR node_modules` (APFS clone). A node_modules symlink is refused by Turbopack ("points out of the filesystem root").

## Left, in order
1. assert-take-timeline: re-point it for `/` (read the band by `[data-stroke-strip] [role=listbox]`, or run its view rows on a host with no take, and replace F1/F2 with the ruled strip behaviour). Not this lane's file; needs an owner.
2. Baselines on this head: assert-drawin-timing 25/25, assert-export-window 39/39, assert-stroke-timing-browser 20/20. `git checkout` any artefact they rewrite.
3. Then the note's first line can say MERGE-READY.
- Dev server :3138 was npm 95313, next 95336, next-server 95342 (cwd this clone), killed by exact pid.

# ANIM-1B3 lane log, 2026-09-25 (stopped at the lane context hook, work done)

## Committed
- 177ac999e `assert-take-timeline.mjs` updated in place. Lane 21/21, main 3a211a36d 20/20 (sparse base without docs/, removed after). Logs and two grabs in `docs/verification/take-timeline/`.
- RUN-QUEUE F118 ANIM-1B3 note (this commit).

## Measured on this head, :3138, headless
- take-timeline 21/21 · drawin-timing 25/25 · export-window 39/39 (it rewrote `real-button-films.png`, checked out) · stroke-timing-browser 20/20 (Extrude and Solid NOT WIRED, its own words) · stroke-strip 18/18 · tsc 6, baseline 6.
- Must-fail shown firing: with the old draw-in-only reader swapped in, F2 and F3 both FAIL (19 PASS 2 FAIL), then restored byte for byte.

## Left
- Nothing blocking. His eye on the strip at localhost is the open call.
- Dev server :3138 was next 50746, next-server 50754 (cwd this clone), killed by exact pid.
## ANIM-1C2, 2026-09-25 (lane/anim1c), stopped at the context line
- Found: Solid drops strokes whose ink is past x = canvasWidth (720 in the gate). The gate injects raw logo polylines spanning x 7 to 1089 px. `renderStrokeToMask` (lib/solid-mask.ts:3700) only rasterizes the canvas rect. Not a list-position bug. Evidence: docs/verification/stroke-timing/anim1c2-probe-*.
- Left: pick the fix (fit the gate fixture, his call since it edits a gate, or raster the pool's bounds in Solid), add a must-fail arm to scripts/verify/solid-bench/gaps.mjs, wire Solid in timedClip, run --grade-solid, four engines, baselines. Details in the ANIM-1C2 note under F118 in docs/RUN-QUEUE.md.

## ANIM-1C3, 2026-09-25 (lane/anim1c), stopped at the context line
- Done: Solid rasterizes union(canvas, ink bounds) (e3fad1f02). Bench identity hero and o 120/120 anim and static; SHAPES 1/5 because 4 fixtures have ink past the bench canvas. gaps.mjs must-fail fails on 43bf2856c, passes after. Solid wired in timedClip (27fc71db3).
- Measured: --grade-solid 36 PASS 2 FAIL (solid 4 ease 0.072 vs 0.101; solid 6a 1/25 against a base recorded while Solid dropped strokes 7 to 11). Baselines 20/20, 24/25 CONTROL, 38/39, 57/60.
- Left: solid 4 diagnosis; his call on re-recording Solid's 6a base; export-window KNOWN-BAD row vs 43bf2856c; the browser exposure test on main (head showed ink past innerWidth / 2 after a shrink, and Solid builds it now). Detail in the ANIM-1C3 note under F118.

## F122, 2026-09-26 (lane/resize), stopped at the context line
- Done: the stale value is named. three 0.175 floors the buffer and rounds the viewport in `setSize`, so a 755.5 px wide canvas draws a 756 px viewport into 755 px until drei's `<Environment>` CubeCamera calls `setRenderTarget(null)` (floor). Panel open 25,763 px off, window resize 29,694 px off, both measured with `_probe-resize-drift.mjs --why` (0b88ed96c). Camera, scene matrices and the stroke-to-world scale are identical A vs B.
- Left: the fix (viewport set to the buffer from a `useStore` subscriber in `Scene`, plus the still export's restore), `assert-resize-settles.mjs` with must-fails, main's no-resize hashes recorded before the fix, the three regressions. Full plan in the F122 note in docs/RUN-QUEUE.md.

## F122-B, 2026-09-26 (lane/resize), MERGE-READY
- Done: `syncViewportToBuffer` in viewport-3d.tsx (Scene store subscriber, still export setSize and restore), `__fsViewportSync=off` must-fail; `assert-resize-settles.mjs` 4/4 graded; still-export, strip 18/18, take-timeline 21/21, key-lanes 11/11, timing 38/38; tsc 6. F123 logged (stale canvasWidth/canvasHeight after a window resize).
- Left: F123. Rebased onto 4b2e21e98; not pushed.
## 2026-09-26 ANIM-3C-W (lane/width, ~/.fs-lanes/width)
Stopped at the context line. Done: width track in lib/keyframes.ts (6297da687, assert-keyframes 16/16, 21/21 mutants), lib/width-keys.ts engine mapping (86aed98ca), F118 note. Left: scripts/verify/assert-width-keys.mjs (5 rows with must-fails, 120-frame identity per engine cross-checked against solid-bench/bench.mjs --sigs) and the rebuild benches that set WIDTH_REBUILD_STEP_MS. Next step: write the gate; the F118 ANIM-3C-W note lists the rows.

## 2026-09-26 ANIM-3C-W2 (lane/width, ~/.fs-lanes/width)
Stopped at the context gate. Done (9c1b39be9): assert-width-keys.mjs 12/12 rows, 9/9 mutants, SIGS 120/120 against bench; bench --engine/--width; hero-sig.mjs; per-engine width bench in the F118 ANIM-3C-W2 note. Left: set the step per engine (1000/30 Solid and Extrude, 250 ms Inflate, reasoning in the note), pass the mode's step from widthForFrame, rerun assert-width-keys and assert-keyframes (not rerun here; lib/ unchanged), rebench with the machine idle.

## 2026-09-26 F125 (lane/f125, ~/.fs-lanes/smallfix)
Stopped at the context line, no fix. Clip proven flat for D through the dwell; D's Solid ink moves 1 to 2 px when stroke 6 opens at 7668 ms (clusters 3 to 4). Next: apply docs/verification/perform/f125-probe-hook.patch, run f125-probe-mesh.mjs (control at 6800/6868) to split geometry from neighbour ink. Note under the F125 row.

## 2026-09-26 HARDEN-A (lane/hardenA, ~/.fs-lanes/hardenA)
Stopped at the context gate. Done: camera-moves NaN rows (5cd306bb5), leaks walks every return (1e16604bc), coverage counts reachable Fields only (307c7e319), each with a must-fail shown firing. Left: undock read-backs, drift/delete exit codes, look empty-systems verdict, width-keys header limits. Next step and plan: the F118 HARDEN-A note in docs/RUN-QUEUE.md.

## 2026-09-26 HARDEN-B (lane/hardenB, ~/.fs-lanes/hardenB)
Stopped at the context line. assert-perform rows 1b (5% cap on the left-out share) and 8 (takeMs, penMs, totalDuration) edited and committed, NOT RUN. Presets Reset row, base provenance in 3 gates, 4 base re-records and key-lanes row 10 pixels and close() are left. Design and base commits for each are in the F118 HARDEN-B note in docs/RUN-QUEUE.md. Next step: item 1 of that note, then run all four gates.

## 2026-09-26 HAND-DRAW-2 (stopped at the context line)
No product code changed. Sheet: docs/verification/hand-clock/sheet/sheet-before.png. Left: stamp the raw recording then processStroke in the app/page.tsx clock memo (Desk Doodles parity), add envelope.fitSeconds (Hand Draw 140/30), gate rows R7 parity and R8 fit with must-fails, re-shoot, run the six regressions and tsc. Full note under HAND-DRAW-2 in docs/RUN-QUEUE.md.
## TEXTURE-ANIM 2026-09-26
Stopped at the context line. Code and gate committed on lane/texanim; gate not yet run, sheet not yet looked at, regressions not run. Next step and details: the TEXTURE-ANIM row at the end of docs/RUN-QUEUE.md.

## TEXTURE-ANIM-2 2026-09-26
The gate passes 3 of 3 rows on the final code, and all three must-fails fire (freeze, off-leak, all-travel). Fixed: a MOVES must-fail that could never fire, a speed leak that graded every live cell frozen, one statistic for the null and the live cell, and one Inflate woodgrain Off frame that was off main's bytes. Stopped at the 150k context gate with the four regressions and tsc not run. Next step: the TEXTURE-ANIM-2 note at the end of docs/RUN-QUEUE.md.

## 2026-09-26 · CURVE-2 handback (retired at the 150k context line)

Done: Custom ease committed on `lane/curve`, `assert-drawin-curve` 18 of 18, six of seven regressions green. Left: `assert-animation-panel` R1 fails on the added Custom pill in its control hash. Next step: rerun R1 with `[data-ease-custom]` excluded from `ctl` and expect 30 of 30 state hashes equal to main; if they match, the gate needs a rebaseline, not a code fix. Dev server stopped, `.next/` deleted.
- 2026-09-26 FLIP-3: flip built, tsc 6, gate + Off base committed; gate NOT run (150k gate). Next: run assert-flip-slash with --strip, then the regressions. See the FLIP-3 note under FLIP-2 in docs/RUN-QUEUE.md.

- 2026-09-26 FLIP-6: the flip settles the camera head-on over the 0.5 s before it, no flag; gate 11/11, regressions green, tsc 6. MERGE-READY. Left: his call on whether an orbit after the settle should stick.

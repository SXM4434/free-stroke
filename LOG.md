NOT MERGE-READY: tsc and every Node gate match the unchanged snapshot, but the export buttons now live in the dock's Export panel and no browser has driven them on this tree. The four export browser gates are the one step left.

# CLOUD-EXPORT lane log, 2026-10-02 (branch claude/export-formats-gif-webm-glb-yfwhh2)

Brief: an animated GIF, a transparent WebM and an animated GLB of the draw-in (coverage rows 94, 96, 92), each in the existing export menu, plus a Node gate `scripts/verify/assert-export-formats.mjs`. The base is the integration snapshot `2cc9e98` (main plus the dockview layout, keyframe anything, Hand Draw phase 3, the carve fix). Nothing is committed under `docs/thinking` or `docs/verification`.

**Branch.** The session was set up on `claude/export-formats-gif-webm-glb-yfwhh2`, cut from this snapshot, and its rules say to push only that branch, so the work is there and not on a `cloud/<job>` branch. No `cloud/export` exists on origin. Say if you want it pushed under that name too.

## What changed course, and why
I built a GIF writer and its gate first (`f41fd55`, pushed). While I was on the WebM step, the controller's session sent a message: the 2026-09-30 lane had already built all three formats on `claude/export-formats-implementation-rs226x`, from an older main. It said to port that work instead and keep its gates. That lane also measured something my design missed: this Chromium's `VideoEncoder` refuses `alpha: "keep"`. So my single-encoder transparent WebM would have refused in practice, and their two-encoder version (a second VP9 stream whose luma is the alpha) is the one that works. I reverted my commit (`bd8c968`, a revert, not a force-push) and dropped my unfinished WebM work. I could not reply to the controller session: this cloud session is not allowed to message other sessions.

## Steps and commits
| step | commit here | ported from | what |
|---|---|---|---|
| 0 | `f41fd55`, reverted in `bd8c968` | mine | GIF writer and a GIF-only gate, replaced by the ported lane |
| 1 | `dcf7ad5` | `3b36b94` | Animated GIF: one ink palette for the whole film, paper and ink core kept exact, no dithering, delays cut from the plan's instants, at most 50 fps |
| 2 | `8d894f5` | `998f74f` | Transparent WebM: a VP9 alpha stream in BlockAdditions with AlphaMode 1; falls back to APNG with a message where WebM cannot be encoded |
| 2b | `2c5340c` | `b038238` | assert-export-app: the dropped ffmpeg call restored |
| 3 | `6ee665b` | `5c02fb8` | Animated GLB: morph targets plus a `draw-in` clip keyed on every planned frame |
| 3b | `fbc0a93` | `371bf32` | Fixes from that lane's review |
| 4 | `864bdf4` | mine | `assert-export-formats.mjs`; the GLB gate's loader honours GATE_MUTATE_FILE |

The two LOG-only commits on that branch (`264c25b`, `ba3fd8a`) are not cherry-picked; their text is in that lane's section below.

**Resolving onto this tree.** Every conflict was the same one: that lane's base had the export bar inline in `components/viewport-3d.tsx`, and this tree moved it into `components/workspace/export-panel.tsx` (the dock's Export panel, layout rethink L3). The viewport side (handlers, `runAnimatedExport`, `DRAWIN_EXPORT`, `filmPlanInput`, `buildAnimatedGlb`) merged on its own. I carried the controls into `ExportPanel` as props, in the same order as that lane's bar:
- name · PNG · Video · **GIF** · GLB · **Anim GLB**
- Video settings: under Background, Transparent shows **WebM | APNG**; the note under it says where each plays; plus a line saying GIF uses these settings.

No new panel was added, and the docked and floating forms both get the controls because they render the same component. One import line conflicted: that lane imported `stripBandPx`, which this tree no longer uses there, so it was dropped. LOG.md conflicts kept this tree's file each time.

## Checks (this tree, compared with the unchanged snapshot `2cc9e98` in this container)
- **tsc:** 6 errors, the baseline (5 in `lib/geometry-engines.ts`, 1 in `lib/dd-engine/handFeel.ts`), after every step.
- **`assert-export-formats` (new):** 3 of 3 rows pass, 6 of 6 must-fails caught, no row without a must-fail.
  - Rows: ROW94-GIF is `assert-export-gif` 8/0; ROW96-WEBM-ALPHA is `assert-export-webm-alpha` 4/0; ROW92-GLB-ANIM is `assert-export-glb-anim` 11/0. Each must exit 0 with no FAIL and at least today's row count.
  - Each format gate builds its file from a fixed frame list, decodes it (its own GIF, EBML and GLB walkers, plus ffmpeg's libvpx-vp9 and three's GLTFLoader and AnimationMixer), and checks frame count, size and the first and last frames against the source. Every row is paired with its own known-bad.
  - Must-fails, each a one-line sabotage of the shipped module through GATE_MUTATE_FILE, all shown firing:

    | sabotage | result |
    |---|---|
    | reserved paper entry one level off | gif 6/2, 38400 paper px wrong on the first frame |
    | GIF delays rounded gap by gap | gif 6/2, 237 cs vs 263 |
    | no AlphaMode | webm-alpha 3/1, alphaMode 0 |
    | alpha plane through limited range | webm-alpha 2/2 |
    | GLB keys 0.5 s off the plan | glb-anim 9/2 |
    | GLB frames show the next stored state | glb-anim 5/6 |

  - One must-fail I first wrote was MISSED and was replaced, not loosened: "drop the ground" left the GIF 8/0. With no ground given, the ink-core reservation picks the most frequent exact colour, which is the paper, so the paper stays exact anyway. The real break is a reserved entry that is not the paper.
- **The six gates in the brief, here vs snapshot:**

  | gate | here | snapshot |
  |---|---|---|
  | assert-keyframes | 16/16, 21/21 | 16/16, 21/21 |
  | assert-key-paths | 6/7, 8/8 | 6/7, 8/8 |
  | assert-width-keys | 12/12, 9/9 | 12/12, 9/9 |
  | assert-camera-moves | 11/11, 20/20 | 11/11, 20/20 |
  | assert-flip-pose | 8/8, 10/10 | 8/8, 10/10 |
  | assert-stroke-timing | 0/1 (RUN), 0/12 | 0/1 (RUN), 0/12 |

  - The two reds are the same on the snapshot and are not code: `assert-key-paths` EXISTING runs `git show 747af8fa0:lib/keyframes.ts`, and `assert-stroke-timing` runs `git archive b0da66626`. Neither commit is in this one-commit snapshot, and `git fetch origin b0da66626` finds no such ref. They need a clone with main's history.
- **Other Node export gates:** `assert-export-encoders` 8/0, `assert-export-plan` 12/0, the same as that lane's base.

## What I could not run
- **No browser gates in this lane, as the brief says.** That leaves `assert-export-gif-app`, `assert-export-webm-alpha-app`, `assert-export-glb-anim-app`, `assert-export-app`, `assert-export-live`, `assert-export-window` and `assert-still-export` unrun on this tree. That lane ran all of them on its own tree (numbers in its section below), but its buttons were in the old inline bar. Here they are in `ExportPanel`.
  - The selectors those gates use are button text: "GIF", "APNG", "Anim GLB", and `[aria-label="Video export settings"]`. The panel keeps that text, but nobody has clicked it. That is why this log says NOT MERGE-READY.
- **ffmpeg-static:** its postinstall did not leave a binary after `pnpm install --frozen-lockfile`, which itself succeeded here. I fetched the binary by running its `install.js` by hand; nothing is committed for it.
- **Playback outside Chrome, a VP8-only browser:** not run, as in that lane.

## Questions for the owner
1. Those four browser gates need a run on this tree before merge. Should a browser lane do it, or should I, in a session that allows it?
2. That lane's six questions stand, unchanged (section below): WebM as the Transparent default; the relative 4:2:0 bar in `assert-export-webm-alpha`; Rod's one-ring dot at playhead 0; GIF always on paper, sharing the Video settings; Anim GLB's label, morph budget and sizes; the lockfile. The lockfile one is resolved on this snapshot: a frozen install works here.
3. Your ruling says every panel can always be rearranged. GIF and Anim GLB sit inside the Export panel's one bar, not as panels of their own. Is that the right home, or should Video, GIF and Anim GLB get a row of their own inside the Export panel?
4. The branch name: keep `claude/export-formats-gif-webm-glb-yfwhh2`, or also push it as `cloud/export`?

---

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

# HAND-DRAW-P3 cloud log, 2026-09-30

Branch `cloud/hand-p3` (the snapshot of main at 4bba17b). Two steps, one commit each, both pushed. Nothing under `docs/thinking` or `docs/verification` is committed; the gates wrote there and it is left untracked.

## Step 1 · 4d76046 · phase 2 back on today's main

`git merge-file <path> base/<path> lane/<path>` on the four files. `lib/stroke-timing.ts` and `scripts/verify/assert-hand-clock.mjs` merged clean. Two conflicts, both kept:
- `components/draw-in-timing-controls.tsx`, the import line: main's `curveOfEase, curveProblem` (Custom curve ease) with phase 2 dropping `takeHasPerformed` (the held clock controls are gone).
- `app/page.tsx`, `handleRevealEnvelopeChange`: phase 2's `rebaseForClock`, so a clock or rate change and the rebase of performed rows are one `edit()`, one undo step, with main's `gesture ?? null` key. `clockUnderTake` and its toast are gone: Hand no longer yields to a performed take. Main's flip wiring (`flip`, `patchFlip`) is untouched.
- Checked: base to main and lane to merged give the same diff on every file.
- `docs/cloud-inbox` removed with `git rm -r`.

## Step 2 · 802ccdb · R11, Inflate's holds, the export row

(a) R11, "Turn in the lifts". Under Hand a slot runs to the next stroke's landing (F120), so the logo's slots touch end to end ([0,520] [520,950] ...) and each lift sits in a slot's tail; only one gap existed (67 ms). The word space is 1792.8 to 1967.2 ms, 174.4 ms.
- `paceFromCurve` returns its flats as `TimingPace.holds`. `takeLiftsMs(ts, pace, baseSlots, baseMs)` turns them into take-time lifts: each stroke inks over its slot less the holds in its base slot, carried through the row (delay, speed, ease inverse); a performed stroke inks its whole slot; lifts are the gaps in the union. Under rows it reads `ts.baseSlots`.
- The strip publishes them on `ctx.liftsRef`; the picker passes them as `CameraTake.lifts`; `orbit-lifts` reads them when given and the slot gaps otherwise.
- Live, logo under Hand: the move is offered and turns at 1792.8 to 1967.2 ms, 0.000 ms off the stamped lift.

(b) Inflate's shader holds. Measured with `scripts/verify/measure-hand-tip-creep.mjs` (Inflate, Hand, the 10 lifts of 50 ms or more, 5 frames per lift, control = the same span inside the stroke before):
- No rows: 0 px change in all 10 lifts. The tip reads the beat, which the pace holds flat.
- A timed take (+1 ms on the last stroke): 5, 28, 28, 27, 5, 26, 19, 52, 61, 18 px. It creeps: the tip reads the take's clock, which runs on through a lift, and the stroke end's nose fills in.
- Fed as point holds at the pen-up and pen-down points (uFsTipHold): worst 13 px, single pixels where strokes cross (the LINEAR filter blends two arrivals).
- A lift has no ink anywhere (that is how `takeLiftsMs` finds it), so the frame loop now holds the whole tip at the lift's start under a timed take (`entry.lifts`, published on `__heroPenTip.lifts`). Result: 0 px in all 10, controls 57 to 317 px. uFsTipHold still carries performed stops only; this is the hold with no radius, not the uniform. Say if you want it moved into the uniform instead.

(c) The export row, R12 in `assert-hand-clock`: `exportAnimation` over `getTotalDuration()` (what the page's own export passes) against live at 8 plan clocks. No rows: 8/8, film 4666.7 ms = take. Last stroke at 0.5x: 8/8, film 5024.9 ms = take (pen 4666.7).

Also in this commit: `assert-stroke-timing`'s two ripple mutants looked for `(t.ripple ? carry : 0)`, which phase 2 moved into `placeSlots` as `(ripple ? carry : 0)`; the mutants now find it (same sabotage, same rows).

## Checks

tsc: 6 errors, the baseline (snapshot 6, after step 1 6, after step 2 6).

Node gates, lane against the snapshot's own run:

| gate | lane | snapshot |
|---|---|---|
| assert-keyframes | 16/16 rows, 21/21 mutants | 16/16, 21/21 |
| assert-key-paths | 6/7, 8/8 (EXISTING red) | 6/7, 8/8 (EXISTING red) |
| assert-camera-moves | 11/11, 20/20 (new IN-LIFTS, 3 new mutants) | 10/10, 17/17 |
| assert-stroke-timing, `STROKE_TIMING_BASE=4bba17b` | 16/16, 12/12 | 16/16, 12/12 |

Browser gates, headless, one browser at a time, lane on :3138 and the snapshot on :3140 from a worktree of 4bba17b:

| gate | lane | snapshot |
|---|---|---|
| assert-hand-clock | 13/13 rows, 13/13 must-fails fired, 0 page errors | 10/10, 10/10 |
| assert-perform, run 1 / run 2 | 11/15, then 10/15 | 13/14 + 1 SELF, then 10/14 + 1 SELF |
| assert-key-lanes (row 11 base re-pinned, see below) | 15/15 graded, row 11 BLIND | 15/15 graded, row 11 SELF |
| assert-stroke-strip | 17/18 | 17/18 |
| assert-take-timeline | 20/21 | 20/21 |

hand-clock must-fails: R11 has two (`lifts-slot-gaps`, `clock-uniform`), counted fired only when both turn it red; both refused the move. R12 `exportpen`: 1/8 clocks, film 4666.7 against take 5024.9. R13 `tip-no-liftholds`: 8 to 40 px per lift. Phase 2's R11 compared `__fsTake.get().slots` (empty with no rows) and called the move itself; it now reads what the picker writes, through the real Camera button. R11 also clears the move's keys after, since R12 and R13 read frames in the lifts it turns in.

Reds read as follows:
- key-paths EXISTING and stroke-timing's own base need 747af8fa0 and b0da66626, which the squashed snapshot does not have. stroke-timing ran with its own `STROKE_TIMING_BASE` knob pointed at the snapshot.
- perform: 1b inflate, extrude, solid and row 2 are red on the snapshot's second run too, so they swing run to run on this machine (4 cores, SwiftShader). Rod 1b passed 2 of 2 on the snapshot and 1 of 2 on the lane (held 1338.2 ms for a 1377.7 ms dwell). Nothing in this change touches Rod's playback, but I could not prove it here; worth one run on the Mac.
- key-lanes row 11: my recorded base came from a docked canvas (755x533) and the full run is undocked (755x890), so the row is BLIND. Its intent holds: the lane's five no-key frame hashes equal the snapshot's, 5 of 5.
- stroke-strip row 0: same cause, the base recorded with `--phase=base` is docked; 18/18 differ on both trees.
- take-timeline E2: 36.0 rAF ticks/s on the lane and 35.9 and 27.4 on the snapshot, against a bar of 50. Headless on a loaded box.

## What I could not run, and how the environment was bent

- `pnpm install --frozen-lockfile` refuses: `pnpm-lock.yaml` lacks `dialkit` and `motion`, which `package.json` lists. Installed with `--no-frozen-lockfile --config.node-linker=hoisted` (the gates import `jiti` directly, which pnpm's default layout does not hoist), then restored the lockfile. Not committed.
- `npx playwright install` was not needed: Chromium 141 is preinstalled. `scripts/verify/lib/browser.mjs` pins channel `chrome`, so `/opt/google/chrome/chrome` was symlinked to it. Outside the repo.
- `lsof` in this container cannot map sockets or cwd to pids, so `serverCommit` saw no server. A PATH-only shim answered its two queries from /proc; dev servers were bound to 127.0.0.1. Outside the repo.
- Bases the snapshot does not carry were recorded from the snapshot server itself, into both trees' `docs/verification` (uncommitted): perform `base-main.json` (`--phase=base --base=4bba17b`), stroke-strip `base-3a211a36d.json` (`--phase=base`), key-lanes `nokeys-base.json` through an uncommitted copy of the gate with `KEYS_BASE` set to 4bba17b (the real one refuses any commit but ea31c5b38). So those rows compare to today's main, not to their named commits.
- Not run: the rest of the plan's PEN rows beyond what these gates carry, `assert-stroke-timing-browser`, `assert-motion-customize`, `assert-custom-presets`, and any look at the result by eye. No Mac numbers were compared.

## Next

- Watch Hand Draw on your own drawing with one row set on the strip, on Inflate: the lifts should now hold as still as with no rows.
- One perform run on the Mac to clear Rod 1b.
- RUN-QUEUE row for HAND-DRAW-P3 is not written; this log is the record.

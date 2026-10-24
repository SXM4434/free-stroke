# CL-EXPORT-MAC lane log, 2026-10-02 (branch claude/export-mac, from integrate/cloud-1001 at 5ff7a7468)

Brief: run the export gates on the Mac against the integration branch, in real Chrome, and fix only gate locators the new dock moved. No product file is edited.

## Setup
- Clone ~/.fs-lanes/cl-gates, sparse, clean before the branch was cut.
- `ffmpeg-static` had no binary in this clone (the same postinstall gap the cloud lane hit). Fetched it by running its `install.js` in `node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static`: ffmpeg 6.0, the version the package pins. Nothing committed for it.

## Node gates (no browser), Mac vs the cloud lane's counts in docs/cloud-handoffs/export-LOG.md
| gate | Mac | cloud |
|---|---|---|
| assert-export-formats | 3 of 3 rows, 6 of 6 must-fails caught | 3 of 3, 6 of 6 |
| assert-export-gif | 8 PASS · 0 FAIL | 8/0 |
| assert-export-webm-alpha | 4 PASS · 0 FAIL | 4/0 |
| assert-export-glb-anim | 11 PASS · 0 FAIL | 11/0 |
| assert-export-encoders | 8 PASS · 0 FAIL | 8/0 |
| assert-export-plan | 12 PASS · 0 FAIL | 12/0 |

No Node row differs from the cloud.

## Plan for the browser gates
Own server: `next dev -p 3141` from this clone, pid written below. Prove it serves this tree (the Export panel's GIF button, or `export-panel` in the served JS) before the first browser gate. Then, one at a time, FS_PORT=3141 FS_HEADED=0: assert-export-app, assert-export-gif-app, assert-export-webm-alpha-app, assert-export-glb-anim-app, assert-export-live, assert-export-window. A red from a locator the dock moved gets the locator fixed. A red whose bar fails is written down as a product finding, with its numbers, and the row is left alone.

## Server
`next dev -p 3141` from this clone: nohup pid 83214, listener pid 83249 (`next-server`, cwd /Users/sebs/.fs-lanes/cl-gates by lsof). Proof before the first browser gate: of the 41 scripts the served `/` loads, 2 carry `export-panel` or `Anim GLB` (`components_workspace_*.js`, `components_viewport-3d_tsx_*.js`).

## Browser gates, real Chrome on the Mac, FS_PORT=3141 FS_HEADED=0
### assert-export-app: 22 PASS · 1 FAIL (cloud: 21 PASS · 2 FAIL)
- No locator moved: the Video button, `Video export settings`, Transparent and APNG were all found in the Export panel as written.
- **FAIL, product finding, bar left alone:** REPRODUCIBLE, the same mark exported twice is the same file. 6 px differ of 22432160 across 38 frames, on 2 of 38 frames (f34 at 512,746 and 512,747), worst channel Δ36. 23 differing subpixels sit on an anti-aliased edge, 0 on flat interior. The 0 ms vs 90 ms arm: 5 px on 2 of 38 frames, worst Δ19, 20 edge, 0 flat. The gate's own note: "Measured 2026-08-07: 0 px on 24 of 24 consecutive runs. A non-zero here is NEW." One run here, so whether this repeats is not measured.
- Differs from the cloud in three rows. The cloud's two reds pass here: the stall row (fast 1.6 s vs slow 4.9 s over 38 frames; SwiftShader's frame time swamped it there) and console errors (0 here; the proxy's ERR_TUNNEL there). The reproducible row passed on SwiftShader, a software rasteriser, and fails on the Mac GPU.
- Film here: 38 frames, 628x940, declared 1.580 s for a 0.942 s pen plus 0.600 s hold. The cloud's film was a different stroke at a different page size (798x1182), so frame counts are not comparable.

### Locators the dock moved, fixed (no row or bar changed)
- `2bd6dc4dc`: assert-export-gif-app timed out on `Video export settings: element is not visible`. The dock loads folded with Timeline showing, so the Export panel's controls are in the DOM but hidden. New `openExportPanel(page)` in `scripts/verify/lib/export-app.mjs` runs the same three lines assert-export-app already ran (`__dockHarness.dock.open("export")`). The GIF, transparent WebM (both pages, the fallback page too) and Anim GLB gates call it right after their stroke is drawn, where assert-export-app opens it.
- `7e95fb194`: assert-export-window crashed after its section D pill row: `getByRole('button', { name: 'Video' })` timed out because the Draw-in tab was showing. `titleOf` now opens the Export tab first, as the same gate's `pressVideo` already did. The Draw-in opener (`[data-animation-drawin]`) is a dock tab, so the pill clicks after it still reach the pills.

### Results after the fixes
| gate | Mac | cloud | differs |
|---|---|---|---|
| assert-export-app | 22 PASS · 1 FAIL | 21 · 2 | yes, see above: stall and console pass here, reproducible fails here |
| assert-export-gif-app | 9 PASS · 0 FAIL | 9/0 | no |
| assert-export-webm-alpha-app | 10 PASS · 0 FAIL | 10/0 | no |
| assert-export-glb-anim-app | 11 PASS · 0 FAIL | 11/0 | no |
| assert-export-live | 9 PASS · 0 FAIL | 9/0 | no |
| assert-export-window | 39 PASS · 0 FAIL | 38 · 1 | yes: "no console errors across the run" passes here (0 errors); the cloud's red was its proxy's ERR_TUNNEL |

The cloud's browser counts are the 2026-09-30 lane's, on its own tree with the old inline bar; the 10-01 port ran no browser gate.

Numbers worth keeping from the green rows:
- GIF: 34 planned = 34 by the walker = 34 by ffmpeg, 628x940 = live; first frame 0 of 590270 paper px wrong, ink mean 1.013; last 0 of 582083, ink mean 0.988; delays 142 cs = panel 1.42 s.
- Transparent WebM: 34 Blocks, 34 with alpha, AlphaMode 1; last frame 98.6% alpha 0, 7144 px opaque; first and last 0 veil px, 41.27 and 42.73 dB; bitrate-coded alpha 856 and 211 veil px against lossless 0 and 0; Chrome's `<video>` plays it 98.6% alpha 0; with WebCodecs deleted the same press writes an APNG and the toast says why.
- Anim GLB: 43 planned frames at 24 fps = 43 keyframes on both channels; last keyframe bounds = static GLB; live first instant 25 ink px (0.45% of the last 5604, Rod's one-ring dot); Solid last area 0.81890 = static.

### The one product finding
assert-export-app REPRODUCIBLE, described under assert-export-app above: 6 px of 22432160 differ between two identical presses, on 2 of 38 frames, all on anti-aliased edges, worst Δ36. It passed on the cloud's SwiftShader. Run once on the Mac; whether it repeats run to run is not measured.

## Not run
- `assert-still-export` (not in this brief).
- A second assert-export-app run to see whether the reproducible red repeats.

## Teardown
Server stopped by pid (83249, then 83214), `.next` deleted. The gates rewrote artefact PNGs under `docs/verification/`; they were copied to the session scratchpad and restored with `git checkout`, so the clone has 0 uncommitted files.

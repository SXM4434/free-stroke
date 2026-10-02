MERGE-READY

# CLOUD-REFIT cloud log, 2026-10-02

Branch `claude/fix-camera-refit-race-i61c4j`, made from `cloud/integrate-1001` (2cc9e98). The harness names the branch, so it is used instead of `cloud/<name>`. Steps 1 to 3 were made by an earlier session on `claude/fix-camera-refit-race-fqep03`. `cloud/refit` did not exist on origin, so this session fast-forwarded to that branch, reran every check from scratch (step 4), and pushed. One commit per step, each pushed. Nothing under `docs/thinking` or `docs/verification` is committed, and the new gate writes nothing to disk.

## Step 4 · this commit · independent rerun

This was a fresh container: `pnpm install --frozen-lockfile`, Chromium 141 headless, and my own `next dev` on :3138. Every result matches steps 1 to 3 exactly.
- tsc: 6 errors (the baseline). `assert-tsc-baseline` FS_PORT=3138: 4 rows PASS, the same six errors (handFeel.ts 1, geometry-engines.ts 5), `/` and `/desk-doodles` 200.
- assert-no-em-dashes: 7 rows PASS, 0 across 142 files. The diff against 2cc9e98 adds 0 em dashes.
- assert-refit-settles: exit 0, 8/8 verdicts hold, 6 PASS and 2 FAIL (the 2 FAILs are the must-fail arm, which FIRED at both sizes). The fix arm gives zoom 77.83837151863455 and hash 034024d070db3834 on all 6 loads at 834x1112, and zoom 122.44528507279061 and hash b518cb4d157de0c2 on all 6 at 1512x982, with 1 refit per load. The `fixed` arm gives 6 zooms and 6 hashes at each size (73.03 to 77.04, 118.22 to 121.74).

## Step 1 · 2b08d48 · refit once the canvas has settled

`app/page.tsx`, the "FRAME THE DRAWING" effect. The camera is orthographic, so the refit's zoom is the canvas half-height over the framed half-height (`applyFraming`), read when the refit runs and kept through later resizes (F123). Before this change the refit ran on a fixed 450 ms timer after the last stroke. Now:
- The 450 ms wait for the geometry stays.
- Then a ResizeObserver watches the 3D canvas and the div R3F measures. A rAF loop counts frames where the canvas box, its drawing buffer and the container box are all unchanged and the canvas has caught up with its container. After 6 such frames in a row, the refit runs once. The observer and the loop are then torn down, so it never re-runs per resize.
- There is a ceiling of 600 frames, so a canvas that never holds still is still framed once.
- If there is no canvas yet, it falls back to the old immediate read, which then gives up as before because there are no bounds.
- `ViewportApi.canvas()` is new in `components/viewport-3d.tsx` and returns `glCanvasRef.current`. It is read-only.
- Must-fail hook: `window.__fsRefitTimer = "fixed"`, dev builds only, read when the effect runs. It brings back the fixed timer.

## Step 2 · fc84100 · `scripts/verify/assert-refit-settles.mjs`

REFIT row, 6 fresh loads of the logo (`injectStrokes`, `logo-strokes.json`) at 834x1112 (stacked) and at 1512x982 (docked). It passes only if all four hold:
- every load ends on the identical camera zoom;
- every load ends on the identical 3D frame hash (still style, reveal 1, `__captureHarness.grab()`);
- each load refits exactly once (zoom writes through `apiOrbitView`);
- on the fix arm, every refit comes after the growth ended.

Controls on the first load of each size: the grab sees the scene (reveal 0.5 hashes differently from reveal 1), and the canvas really grew 30 px. Any load that saw no refit or no growth is BLIND, and a blind must-fail is never counted as fired.

**The growth is driven, so be aware of it.** On this tree, headless, the race does not happen by itself. I measured it with a probe:
- the 3D canvas is sized 210 to 230 ms after the strokes land;
- then the first build blocks the main thread for about 1.9 s;
- when the block ends, the overdue timer and the first framing run together, on a canvas that has already settled.

In that setup both arms read the same three plain loads (zoom 77.838 at 834x1112), so the must-fail could not fire. So the gate does what main's stacked canvas does:
- a stylesheet mounts R3F's wrapper short by 30, 25, 20, 15, 10 or 5 px, a different amount on each load;
- it opens back to full height over 700 ms, starting when the WebGL context is made.

With the fix, the gate's frames are the same as a plain load with no growth: hash 034024d070db3834 at 834x1112.

## Checks

- tsc: 6 errors, the baseline, after both steps. `assert-tsc-baseline` with `FS_PORT=3138`: all PASS, the same six errors in the same two files, both routes 200.
- assert-no-em-dashes: 7 rows PASS, 0 across 142 files. `git diff` adds no em dash.
- assert-refit-settles, headless, against my own `next dev` on :3138 (Chromium 141), exit 0, **8/8 verdicts hold, 6 PASS, 2 FAIL (the 2 FAILs are the must-fail arm, as intended)**:

| row | fix arm | must-fail `fixed` |
|---|---|---|
| REFIT 834x1112 | PASS: 1 zoom (77.83837151863455), 1 hash (034024d070db3834), 1 refit per load, all after the growth | FIRED: 6 zooms (73.03 to 77.04), 6 hashes |
| REFIT 1512x982 | PASS: 1 zoom (122.44528507279061), 1 hash (b518cb4d157de0c2), 1 refit per load, all after the growth | FIRED: 6 zooms (118.22 to 121.74), 6 hashes |
| CONTROL grab sees scene | PASS at both sizes | |
| CONTROL canvas grew | PASS: 456 to 486, 840 to 870 | |

## What I could not run

- **The natural race as you measured it.** The 188 to 217.72 px growth and zooms 34.78, 34.68, 33.92, 33.92 came from main's layout. On this tree in this container the 3D canvas is 786x486 at 834x1112 and does not grow during load. The gate therefore drives the growth, and I could not reproduce your numbers. One run on the Mac, at 834x1112, would confirm it there.
- **assert-camera-frames-the-drawing.** It imports `sharp`, which is not installed in this tree (ERR_MODULE_NOT_FOUND).
- **assert-dock-shell and assert-resize-settles.** Both need things that are absent here: a reference server of main, and a base file under `docs/verification`. The dock-shell AT LOAD row is print-only anyway. With this fix it should now read the settled half-height on the lane.
- **Browser setup.** `lib/browser.mjs` pins `channel: "chrome"` and there is no Google Chrome here. I symlinked `/opt/google/chrome/chrome` to the preinstalled Playwright Chromium (outside the repo). The run uses SwiftShader with no GPU, at about 8 fps after the first build.
- **The gate is not in `scripts/verify/lib/control-manifest.json`.** Neither are the recent assert-resize-settles, assert-dock-shell or assert-hand-clock. assert-gate-integrity was not run.
- **Known limits of the fix.**
  - A growth that pauses for more than 6 frames will be refit at the pause.
  - The refit waits for animation frames, so a background tab refits when it is shown.

MERGE-READY

# CLOUD-K2LIVE log, 2026-10-03

Branch `claude/keyed-style-playback-3r6jcq`, cut from `cloud/k2live` (d38fec4, the snapshot of integrate/cloud-1001). This session's harness assigns that branch, so every push went there. Nothing was pushed to `cloud/k2live`, which is the base, not my own branch. REVIEW.md "Review 1: layout and keyed style", findings 1, 2, 5, 6, 7, 10 and 11. Findings 3, 4, 8 and 9 are not touched, and `components/dock-shell.tsx` is unchanged (finding 11 did not need it). Nothing under `docs/thinking` or `docs/verification` was created or committed. There are no em dashes in anything added.

The previous LOG.md (HAND-DRAW-P3, 2026-09-30) is in git history at d38fec4.

## Steps

| step | commit | what |
|---|---|---|
| 1a | 6b3694a | Ports K2's viewport half from ae75d6bae (cloud/layout-l3), which was lost when the snapshot was folded by hand. A teammate session pointed to it. Applied with `git apply -3`, with one conflict in the keyframes import line. The frame loop reads `styleAt(styleState, framedKeys(keys), clockMs)` on the key reader's clock. Keyed loop speeds run as a sum. `__geomDebug.keyedStyle` records each frame. |
| 1b | 03f8125 | `loopSpeedOver` (lib/keyframes.ts): over each frame a loop runs at the mean of its keyed speed across the key clock's step, read through `loopPhaseAt`, for the texture, dither, ASCII and material loops. The viewport has one `keyedStyleAtMs` and one `exportPlayhead`. The film seeks through it. The static GLB takes the keyed Custom material at the key clock the view shows. The animated GLB writes keyed roughness, metalness, clearcoat and emissive strength as `KHR_animation_pointer` channels on the draw-in clip (lib/export/glb-material-keys.ts). Sheen weight and environment strength have no glTF property, so the receipt names them as not in the file. |
| 2 | 65997c1 | `readKeys` (lib/doc-store.ts) accepts any `isKeyPath` name and checks each track against its own range. A valid style key reloads with no repair. |
| 5 | f6c28de | New pure module lib/key-edit.ts. `keyedStyleEdit` keys each path on its own: a refused path keeps its track and is named, and the other paths of a multi-path edit (a preset) keep their keys. `refusalWords` produces lines such as "Not keyed: 26 is outside 4 to 24" and "Not removed: without this key the curve would swing to -0.184, outside 0 to 1". The words show beside the path's diamond (role=status) and clear on the next key or after 6 s. |
| 6 | ddeae29 | `cadenceClock` (lib/stroke-schedule.ts) is the one clock step for live playback and `exportPlayhead`, so the video, the GIF and the animated GLB step on twos as the screen does. Adds dev-only `__revealHarness.setCadence`. |
| 7 | c0cb18e | `keyClockMs` reads the transport's `playheadRef`. `createProgressThrottle` writes the playhead when its timer fires and flushes on every pause and at the end of a pass. |
| 10 | 1bce7ff | `settleStyleSample`: every `styleAt` sample is clamped to its slider's range and snapped to whole-number steps (ditherLevels, asciiCellSize, ditherAngle). Fractional steps stay smooth. This also closes CLOUD-TESTS' D6 and D7 without moving reachReasons' bar. |
| 11 | f3833f4 | `resetSilently` marks a notify as owed, and `notifyReset` sends it after the viewport mounts (every slot, the readout, the derived values). Adds dev-only `__fsRemountViewport` in the wrapper, which re-keys `<Viewport3D>` the way "Rebuild the view" does. |
| 1 gate | 526f7a6 | assert-keyed-playback-live L7 reads a real Anim GLB file. |

## Checks

tsc: 6 errors, the baseline, after every step.

Node gates:

| gate | result |
|---|---|
| assert-keyed-playback (new) | 10 of 10 rows, 21 of 21 mutants caught (F1-LOOP, F1-GLB, F2-RELOAD, F5-EDIT, F5-WORDS, F6-CADENCE, F7-CLOCK, F7-THROTTLE, F10-STEP, F11-RESET) |
| assert-keyed-ranges (ported from CLOUD-TESTS 5d5c659e5) | 3 of 3 rows, 10 of 10 mutants. RANGES was red at 5d5c659e5 (14 of 90292 samples an ulp out) and is now green with 0 outside. Bars are unchanged. One mutant follows the line it targeted; one new mutant removes the clamp. |
| assert-key-paths | 6 of 7 rows, 8 of 8 mutants. EXISTING is red, the same as on the snapshot, because commit 747af8fa0 is not in this clone. One mutant follows the line it targeted. |
| assert-keyframes | 16 of 16 rows, 21 of 21 mutants |
| assert-transport-math | not present in this tree |

Browser gates. Each runs on its own `next dev` (:3140, FS_HEADED=0). The reference is a worktree of d38fec4 on :3139.

| gate | result |
|---|---|
| assert-keyed-playback-live (new) | 17 PASS, 0 FAIL. L1: textureIntensity keyed 0 to 1 over 2 s while playing; the 3D canvas follows (rank 1.000, 31 levels once held). L2: the exported WebM follows (rank 1.000, 45 levels). L3: refusal words beside the diamond. L4: Twos in film and live. L5: key clock at the end, on Pause and on click. L6: a remount reaches the dock. L7: Anim GLB channels. Each row's must-fail fired, including the viewport fed the raw styleState (L1, L2). |
| assert-keyed-style (K2) | 15 PASS, 0 FAIL with `--ref`. K4, the unkeyed frames, is byte-identical to the base tree. K1 and K1m now expect the mean speed over each frame's step and gained the "endspeed" must-fail. |
| assert-take-transport | 9 PASS, 0 FAIL |
| assert-key-buttons | 11 PASS, 1 FAIL. B1 fails because ditherAngle has no key button, and it fails the same way on the base snapshot. |
| assert-drawin-timing | 25 PASS. The one FAIL is a resource blocked by the sandbox's network (ERR_TUNNEL_CONNECTION_FAILED). The base gets 24 PASS with the same network FAIL. |

## Not run, or not able to run

- No real Chrome. Playwright's install from dl.google.com is blocked by the proxy, so `/opt/google/chrome/chrome` is a symlink to Playwright's Chromium 141, which the repo's launcher pins as "chrome". The GPU is software.
- assert-key-lanes refuses to run without `docs/verification/keyframes/nokeys-base.json`, which this job may not create.
- assert-export-glb-anim-app stops at a hidden "Transparent" button, on this tree and on the base alike. L7 covers the animated GLB path in its place.
- The crash law (`__styleHarness.crashViewport`) takes the whole development page down on this tree and on the base, even with `console.timeStamp` deleted, so the error boundary's remount cannot be driven. L6 uses `__fsRemountViewport` instead, which performs the same re-key.
- I could not reply to the teammate session (bridge:session_0184LDcKA7gcoxuK7T3Y8EHW), because this cloud session cannot message other sessions. Its requests were done here: the ae75d6bae port is step 1a, assert-keyed-ranges is ported, D6 and D7 are fixed in step 10, and `__geomDebug.keyedStyle` is live, so harness-surface row B should be green.

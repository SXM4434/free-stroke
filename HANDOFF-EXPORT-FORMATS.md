# Export formats lane, handoff

Branch: claude/export-formats-implementation-rs226x (on top of the cloud/export-formats snapshot 52982e8). Full detail, every count and the owner's questions: LOG.md, top section.

## Done
- Animated GIF (3b36b94): GIF button after Video, shares the Video panel settings, always on paper, max 50 fps, one palette for the film with paper and ink reserved exactly, no dithering.
- Transparent WebM (998f74f): Transparent offers WebM (default) or APNG; alpha as a second lossless VP9 stream (BlockAdditional, AlphaMode 1); APNG fallback with a toast when the browser cannot encode WebM.
- Animated GLB (5c02fb8): Anim GLB button after GLB; draw-in as morph targets keyed on the Video panel's frame plan; sparse accessors; base pose is the finished mark.
- Fixes: b038238 (assert-export-app syntax error I introduced in 998f74f), 371bf32 (review fixes).

## Gates (this container's Chromium, SwiftShader; each compared with its own run on the unchanged base, never Mac numbers)
- tsc: 6, the baseline, at every step.
- New: assert-export-gif 8/0, assert-export-gif-app 9/0, assert-export-webm-alpha 4/0, assert-export-webm-alpha-app 10/0, assert-export-glb-anim 11/0, assert-export-glb-anim-app 11/0. Every row paired with a must-fail that fired.
- Regression, equal to base: encoders 8/0, plan 12/0, live 9/0, export-app 21 PASS 2 FAIL, still-export 10 PASS 1 FAIL, export-window 38 PASS 1 FAIL. The failures are the same rows on base (the proxy's ERR_TUNNEL console error; a stall-timing row the slow renderer swamps).

## Left
- Run the three new browser gates on the Mac with real Chrome (not possible here: proxy 403).
- Owner calls (LOG.md, Questions): WebM as Transparent default; the relative WebM colour bar; Rod's one-ring dot at playhead 0; Anim GLB label, sizes and the small crossing nick on Solid and Inflate; stale pnpm-lock.yaml.
- To bring back: git cherry-pick 3b36b94^..<branch head> onto the local branch.

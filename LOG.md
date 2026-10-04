NOT MERGE-READY

# CLOUD-LAYOUT log, 2026-10-04

Branch `cloud/layout`, from the integration snapshot 2cc9e98. Stopped early on the owner's word (usage nearly out). Steps 1 to 3 are committed and pushed; steps 4 to 7 exist as patch scripts in `handoff/cloud-layout/`, written but not applied or gated. Nothing under `docs/thinking` or `docs/verification` is committed.

## Done

| step | commit | what |
|---|---|---|
| 1 | e77bdae | The maximized dock's floating 3D preview sits inside the window, 12 px in, at any shell size (sized with `previewBox`, floats bounded, the 3D column clipped below lg), and it is placed again when the window crosses 1024 px while maximized. The drawing is framed to the preview through the camera's view offset only (`PreviewFit`, viewport-3d.tsx), cleared on restore, so the main view's framing is untouched (assert-maximize X2 byte-equal frame). Gate: assert-maximize X8, X9 with the previewLoose and previewNoFit arms. |
| 2 | 8c1b393 | The open dock follows its content up to its cap (Animate 390 px or 40% of a short shell, a third elsewhere, or the height a divider drag left it); the default cap never cuts the closed strip (the controller's 1280x800 finding). Maximized, the open key lanes take the height left, rows 36 to 64 px (cap chosen: 64), bottom rows clear of the preview. Gate: assert-dock-panels R6, R7, R8 with the nofit, fill-off and stripcut arms. assert-key-lanes gains `--no-base` (row 11 then fails, never passes). |
| 3 | this commit | Every panel can always be rearranged: `disableDnd` and `locked` off; a moved hidden panel shows; folding only where the dock's height is its own; a move made while maximized is kept by the restore; the shell's own preview float is not counted as a move; the fold hold yields to a divider drag. Two dockview 8.3.1 overlay defects worked round in `syncOverlays`: a zero-size group's overlay kept its old geometry over another panel (it ate drops on the 3D view), and the 3D canvas stayed 1464 px after dockview's maximize and a tab hide (assert-dock-shell SURVIVES (d), red about one run in three on the unchanged snapshot too). New gate scripts/verify/assert-rearrange.mjs. Ported from CLOUD-TESTS (0cd67dcfd): assert-workspace-layouts.mjs and _probe-layout-fromjson.mjs. |

## Left (patch scripts in handoff/cloud-layout, apply in this order, then gate)

- step4.py: toolbars wrap at narrow widths (Drawing toolbar, the dock header and transport), `__fsToolbarMutant="nowrap"` arm. Gate row RA8 in assert-rearrange is written; never run.
- step6.py: layoutProblem hardened (D1 to D5) and a catch round fromJSON with a note; the layoutProblem toast delayed a tick (it was dropped at mount); assert-workspace-layouts must-fails rewritten for the fixed product. Gate rows: LOADABLE (Node) and RA9 (assert-rearrange, written, never run).
- step5.py (needs step6 first): a rail click while maximized does what its button said. Gate X10 in assert-maximize (written; red until applied).
- step7.py: the `maxstuck` arm for X11 (the 1024 px fix itself landed in step 1). X11 is green; its must-fail is BLIND until this is applied.
- LOG items not done: the after-pictures (scripts/verify/_shots-integrate.mjs does not exist in this snapshot), the base-vs-lane rerun of every gate on the final tree.

## Checks (latest run of each, lane on :3138 vs the unchanged snapshot on :3140)

| check | lane | snapshot |
|---|---|---|
| tsc | 6 errors (baseline) | 6 |
| assert-keyframes / key-paths / width-keys / camera-moves / flip-pose | not rerun after step 1 (no lib changes) | 16/16, 6/7 (EXISTING), 12/12, 11/11, 8/8 |
| assert-stroke-timing, STROKE_TIMING_BASE=2cc9e98 | not rerun | 16/16, 12/12 (b0da66626 is not in this snapshot) |
| assert-workspace-layouts (ported) | 4/5, LOADABLE red until step6.py | same |
| assert-rearrange RA1 to RA7 | RA1 15/15, RA2 90/90, RA3 6/6, RA4, RA5, RA6, RA7 pass, all must-fails fired (runs before the last syncOverlays edit; the final rerun was cut off after RA2) | n/a |
| assert-maximize | 21/23: X10 red (step5 pending), X11 must-fail BLIND (step7 pending) | 15/15 |
| assert-dock-panels | 17/17 | 11/11 |
| assert-workspaces | 15/15 | 15/15 |
| assert-hit-targets | 15/15 | 15/15 |
| assert-dock-shell clean | 11/11 in 3 of 3 runs after the canvas fix | 11/11, 10/11, 11/11, 11/11 (SURVIVES (d) flakes) |
| assert-stroke-strip | 17/18 (row 0 needs base-3a211a36d.json) | 17/18 |
| assert-take-transport | 9/9 | 9/9 |
| assert-animation-panel | NOT RUN: main-popover-baseline.json is not in any reachable ref | NOT RUN |
| assert-key-lanes | NOT RUN (nokeys-base.json from ea31c5b38 not reachable; `--no-base` added for next time) | NOT RUN |

Browser: the preinstalled Chromium 141 symlinked at /opt/google/chrome/chrome for `channel: "chrome"`, headless, Linux (no `--use-angle=metal`).

## Questions for the owner

1. The 64 px cap on maximized key rows: past it the lanes' area (quarter lines, playhead) still runs to the bottom. Taller, or give the rest to the strokes band?
2. A panel sharing a tab group: the rail's hide hides the whole group. Should hiding one panel move it out first?
3. Push target: the brief said `cloud/layout`; the wrap-up note said a `claude/*` branch. Both carry these commits.

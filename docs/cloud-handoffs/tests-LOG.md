NOT MERGE-READY

# CLOUD-TESTS cloud log, 2026-10-02

Node gates for code a cloud session wrote without a browser, on the integration snapshot (2cc9e98, cloud/integrate-1001). No product code changed. Nothing under `docs/thinking` or `docs/verification` is committed.

Why NOT MERGE-READY: two of the three new gates are red on purpose, each on a real product defect named below. Merging them as they are puts two red gates on main. The owner decides: fix the product first, or merge the gates red as a to-do.

Branch: pushed to `claude/node-tests-cloud-session-g2cb4v`, the branch this session was assigned, not `cloud/tests`. No `cloud/tests` existed on origin, so there was no earlier LOG to continue from.

## Step 1 · 6bcc4ab · assert-transport-math (lib/take-transport.ts)

`scripts/verify/assert-transport-math.mjs`, 8 rows, 12 mutants, green.
- MODE, LENGTHS, SEAM: `revealModeOf`, `transportLengths` and `seamWindowOf` match the inline viewport lines that L2 step 4 removed (6b24ba5 on cloud/layout-l2, copied into the gate as OLD). That covers 15 override/pace pairs, 480 take/pen/key-end triples under `Object.is` (0, -0, NaN, Infinity, and a 0 ms take staying 0), and 112 window/loop/delay cases. The SEAM row also checks the stated seamless rule written out by hand, and that the window keeps its identity when it is not seamless.
- UNEASE: `unEaseReveal` is bit-equal to the old bisection on 567 (ease, p) pairs, including two bezier curves. The round trip is within 1.4e-9, the ends are exact under every ease, and it is monotone.
- STORE, DERIVED, RESET, PROGRESS: per-slot notify, `Object.is` dedup (NaN, -0), the updater form, stable frozen setters, isolated stores, `publishDerived` dropping no-change publishes, `resetSilently` matching a fresh store with no notify, and the readout store.

## Step 2 · 0cd67dc · assert-workspace-layouts (components/workspace/workspaces.ts)

`scripts/verify/assert-workspace-layouts.mjs`, 5 rows (4 pass), 9 mutants caught. Also `scripts/verify/_probe-layout-fromjson.mjs`, which runs dockview-core 8.3.1's own `fromJSON` in headless Chromium.
- DEFAULTS: 27 of 27 defaults (3 workspaces, 6 wide and 3 stacked sizes) round-trip through JSON, pass `layoutProblem`, list exactly `PANEL_IDS`, place each panel once, and fill the shell.
- KEYS: each workspace saves, reads and deletes only `fs.layout.v1.<ws>`. The current-workspace key is separate, an unparsable save is refused, and with blocked storage every call answers and none throws.
- UNKNOWN: 7 of 7 cases are refused by name or repaired. An unknown view in the grid only is dropped by dockview, which loads the six panels (the probe confirms this).
- NOTHROW: `layoutProblem` never throws on 6016 corrupt saves and odd values.
- **LOADABLE: FAIL, a real bug.** `layoutProblem` (`components/workspace/workspaces.ts:165-194`) checks panel names, not the shape dockview needs. The shell passes anything it accepts straight to `api.fromJSON`, inside a try/finally with no catch (`components/dock-shell.tsx:757-766`, called at 788 / 861 / 943 / 997). In the probe, on both the first load and a switch:
  - A non-string group id (the walk at `workspaces.ts:179` never reads `data.id`) makes dockview throw "group id must be of type string" and leaves 0 panels.
  - A root that is a leaf (`workspaces.ts:188` accepts any leaf root) makes dockview throw "root must be of type branch".
  - A panel entry that is null (`workspaces.ts:170` reads only the keys) makes dockview silently drop that panel. Style is gone, which breaks "every panel can always be rearranged".
  - An entry whose `id` names another panel builds a panel called `ghost` on first load instead of `drawing`.
  - An entry naming an unknown `contentComponent` loads in dockview-core. dockview-react would then render `components["ghost"]`, which is undefined. I read that from its code; I did not run it.
  - In the 6000-save fuzz, 1368 of the 2729 saves `layoutProblem` passes are of these kinds.
- Must-fails for LOADABLE: the row is already red, so a mutant turning it red would prove nothing. The gate applies a candidate `layoutProblem` fix (root is a branch, string group ids, each entry an object with its own id and component) through GATE_MUTATE_FILE only. That turns all 5 rows green (MUST-PASS). The same fix without its entry-id check turns LOADABLE red again. The candidate is in the gate as `FIX`; whether to adopt it is the owner's call.

## Step 3 · 5d5c659 · assert-keyed-ranges (lib/keyframes.ts)

`scripts/verify/assert-keyed-ranges.mjs`, 3 rows (2 pass), 9 mutants caught. It takes about 2 minutes, most of it the mutants.
- **RANGES: FAIL, a real bug, rounding-scale.** I ran 38 paths x 120 seeded tracks: 3686 accepted, 874 refused (every refusal names its range). Of 90292 `styleAt` samples, 14 land outside the path's range, by at most 5.9e-16 of the range (roughness 1.0000000000000002, or -2.8e-17). There are two causes:
  1. `cubicBezierEase` (`lib/flip-pose.ts:59`, `calc`, returned at 85) gives 1.0000000000000002 just before a key whose in-handle has y = 1, which is AE's Easy Ease, the default key. `valueAt` (`lib/keyframes.ts:433`) then lerps a hair past the key. So keying a value to its slider's end with the default ease can sample one ulp outside.
  2. The tolerance in `reachReasons` (`lib/keyframes.ts:285`, `eps = 1e-9 * range`) accepts a curve that really does dip under the range (1.1e-26 under asciiDelay's 0).
  Nothing reads sampled values against STYLE_RANGES today (`STYLE_RANGES` has no reader outside `lib/keyframes.ts`), so it is harmless now. It still breaks the module's own contract that values stay in range and are never clamped. The candidate `FIX` in the gate clamps the ease to the span's own `spanReach`, returns exact key values at the ends, and sets eps to 0. Under it all 3 rows go green. The RANGES must-fails are FIX plus each sabotage.
- EDGES: 114 of 114 tracks touching both ends of every range are accepted, stay inside, and reach both ends exactly.
- PHASE: on all 6 loop speed paths, 24 accepted ramps each:
  - no jump: 0 at 560 keys and at clock 0. The largest step across a key is 6e-10 s, against a 1e-8 s bar.
  - per frame: 0 of 22915 frame steps over the speed bound.
  - the sum: within 5.2e-4 s of a 20000-step trapezoid, against a 1e-3 s bar.
  - unkeyed: exactly speed times time.
  The per-frame floor of 1e-4 s (1/166 of a frame) was set after the first run. With a 1e-6 s floor, one frame read 1.0015x its bound, 1.5e-5 s over. That comes from the 64-step Simpson sum: on a 1.5 s span its nodes sit 23 ms apart, so the sum wobbles. It is continuous, not a jump. The speed-times-time mutant is caught at this floor.

## Product defects, each with the input that shows it

D1. `layoutProblem` passes a save dockview throws on (`components/workspace/workspaces.ts:179`, the leaf walk never reads `data.id`; thrown out of `components/dock-shell.tsx:757-766`, no catch). Input: `defaultLayout("animate", 1464, 942, true)` with the first leaf's `data.id = 7`. `layoutProblem` returns null; dockview-core `fromJSON` throws "dockview: group id must be of type string" and leaves 0 panels.

D2. `layoutProblem` passes a leaf root (`workspaces.ts:188`, the walk accepts any leaf as root). Input: the same default with `grid.root = { type: "leaf", data: { views: [all six], activeView: "drawing", id: "g-all" }, size: 942 }`. It returns null; dockview throws "dockview: root must be of type branch".

D3. `layoutProblem` passes a null panel entry (`workspaces.ts:170`, only the keys are read). Input: the default with `panels.style = null`. It returns null; dockview loads drawin, drawing, export, timeline and view3d, with one empty group. Style is lost until Reset.

D4. `layoutProblem` passes an entry naming another panel id. Input: the default with `panels.drawing.id = "ghost"`. It returns null; on first load dockview builds a panel `ghost` and no `drawing`.

D5. (Read from code, not run.) An entry naming an unknown component. Input: `panels.view3d.contentComponent = "ghost"`. It returns null; dockview-react renders `components["ghost"]`, which is undefined.

D1 to D4 are reproduced by `node scripts/verify/_probe-layout-fromjson.mjs`.

D6. Easy Ease sampled one ulp past a range (`lib/flip-pose.ts:59` calc, lerped at `lib/keyframes.ts:433`). Input: `customMaterial.roughness` keys `{tMs, value: 0.4963588328100741, easeOut: {x: 0.3505, y: -0.2279}}` to `{value: 1, easeIn: EASY_EASE_IN}`, sampled at u = 0.9999999999988765 of the span. The ease reads 1.0000000000000004 and roughness reads 1.0000000000000002, range 0..1.

D7. The `reachReasons` tolerance accepts a curve that dips under its range (`lib/keyframes.ts:285`, `eps = 1e-9 * range`). Input: `asciiDelay` keys from value 0 (easeOut `{x: 1/3, y: 0}`) to 2.980888083577156 (easeIn `{x: 0.1113, y: -0.000152}`). `acceptKeys` accepts it, and `styleAt` samples -1.14e-26 at u = 2.9e-12, range min 0.

D6 and D7 are found by `node scripts/verify/assert-keyed-ranges.mjs`, RANGES row (seed 20261002).

## Checks
| check | this branch | unchanged base (2cc9e98) |
|---|---|---|
| tsc | 6 errors (5 geometry-engines, 1 handFeel) | 6 |
| assert-keyframes | 16/16 rows, 21/21 mutants | same |
| assert-key-paths | 6/7 rows, 8/8 mutants | same |
| assert-width-keys | 12/12, 9/9 | same |
| assert-camera-moves | 11/11, 20/20 | same |
| assert-flip-pose | 8/8, 10/10 | same |
| assert-stroke-timing | 0/1 (RUN), 0/12 | same |
| assert-no-em-dashes | 7 rows, 142 files, green | same |
| assert-gate-integrity | refuses (analyser 1/41 uncalibrated, no log corpus) | same output |
| assert-transport-math (new) | 8/8, 12/12 | n/a |
| assert-workspace-layouts (new) | 4/5, 9/9 | n/a |
| assert-keyed-ranges (new) | 2/3, 9/9 | n/a |

The red rows in assert-key-paths (EXISTING) and assert-stroke-timing (RUN) are environmental, and they are identical on the unchanged base. They run `git show 747af8fa0` and `git archive b0da66626`, and this squashed snapshot (and origin/main) does not have those commits. Neither is caused by this branch.

## What I could not run
- Browser gates (assert-workspaces, assert-take-transport and the rest). `scripts/verify/lib/browser.mjs` pins `channel: "chrome"`, and `npx playwright install --with-deps chrome` failed in this container. Product code is unchanged, so they have nothing new to measure here. The probe uses Playwright's own Chromium (`/opt/pw-browsers/chromium`), since it does no GPU work.
- How dockview-react responds to an unknown `contentComponent`: read from its code, not run.

## Questions for the owner
1. Should `layoutProblem` take the stricter checks (step 2's `FIX` or similar), or should `loadLayout` catch a failed `fromJSON` and fall back to the default with a toast? The second would also cover anything dockview rejects in future.
2. Ulp-scale samples outside a range: fix in `valueAt` (step 3's `FIX`), or treat a rounding margin as in range? Either way the RANGES bar needs your ruling. I did not loosen it.
3. The shell mounts dockview with `disableDnd` and `locked` (`components/dock-shell.tsx:1078-1079`). Panels can be shown, hidden and maximized, but not dragged. Does that satisfy "every panel can always be rearranged"?
4. Should the branch be renamed to `cloud/tests`? The session was assigned `claude/node-tests-cloud-session-g2cb4v`.

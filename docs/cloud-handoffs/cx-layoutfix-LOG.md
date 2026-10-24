DONE

CX-LAYOUTFIX, 2026-10-02. No browser was run in this job.

1. Plan recorded in `9c4901e54`.
2. Dock shell and validator fixed in `6a2dae0ff`. Rail clicks apply the pressed state visible at click time after restore. Crossing 1024 px clears maximize before loading the workspace. Saved layouts with a bad root, group id, panel entry, entry id, or content component are refused. If dockview still throws, the shell loads the current workspace default and shows a warning after the toaster mounts.
3. The layout gate's mutant input was updated in `cdd66479b`. Its bar and rows are unchanged. The old candidate fix is installed in the product, so the mutant now removes the installed entry id check to reproduce D4.

Gates

- `assert-workspace-layouts.mjs`: 5 of 5 rows pass; 8 of 8 must-fails caught. LOADABLE: 5 of 5 hand cases refused or loadable; 1361 of 6000 corrupt saves passed the validator, and 0 of those 1361 failed the gate's dockview loadability model. DEFAULTS: 27 of 27. UNKNOWN: 7 of 7. NOTHROW: 6016 of 6016 inputs answered without a throw. The gate models dockview and does not execute the shell.
- `assert-transport-math.mjs`: 8 of 8 rows pass; 12 of 12 must-fails caught.
- `tsc --noEmit -p .`: 6 errors, the expected 6. One missing `perfect-freehand` module and five missing `MaskSolidDiagnostics` fields. No error points to the changed files.
- `git diff --check`: pass. Browser gates and `_probe-layout-fromjson.mjs` were not run because both require a browser, and this job assigns browser verification to a Claude lane. No dev server was started. `.next` was absent and `docs/verification` was clean.

Browser rows for the Claude lane

1. At 1512 x 982, reset Draw. The shell is 1464 x 942. Maximize Drawing, wait for the rail to show Timeline as unpressed with tooltip `show`, then click Timeline once. Expect maximize current `null`, six panel ids still present, Timeline visible `true`, Drawing visible `true`, 3D view visible `true`, Style visible `false`. Repeat from reset Draw with Drawing maximized: its rail button is pressed with tooltip `hide`; click Drawing once. Expect maximize current `null` and Drawing visible `false` with the other five panel ids still present. These two clicks cover both sides of the label at click time.
2. At 1512 x 982, reset Style, maximize Style, resize the viewport to 1023 px wide, then back to 1512 px. Expect maximize current `null`, zero maximize buttons with `aria-pressed=true`, and the Style header label `Maximize Style`, not `Restore the layout`. Click Style's rail button to hide it, wait more than 300 ms, and read `fs.layout.v1.style`: its Style group has `visible: false`. Reload at 1512 px. Expect six panel ids, Style still hidden, and maximize current `null`. This checks the breakpoint clears maximize and permits the next save.

The browser rows also need to check that the warning is visible and the six panels return after forcing `fromJSON` to throw. The Node gate cannot prove the shell catch or the rail and breakpoint interactions.

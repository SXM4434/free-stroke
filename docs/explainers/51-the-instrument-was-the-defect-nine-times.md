# 51 · The instrument was the defect, nine times in one day

**2026-09-04.** He said the animation was crap every time he played it. He was right, and finding
out why took nine wrong instruments before one right one. This is the record of the wrong ones,
because the fixes are one line each and the pattern is the whole lesson.

---

## The finding, first, so the rest has a point

**Nothing framed the camera to your drawing.** Filmed at 24 frames across the beat: the first
stroke drew over the opening second, and **eighteen of the remaining frames were a static first
stroke while the other two strokes drew off-screen to the right.** You could watch them clip in at
the frame edge and never arrive.

One click of "Reset camera" before pressing play fixed it completely, on the same code and the
same settings. That is what proved the camera could always frame the mark and that nothing ever
asked it to. `app/page.tsx` now refits on growth only, so it cannot fight a camera you set
yourself.

**It was found by looking at a contact sheet, not by measuring.** Every number that day agreed the
app was fine.

---

## The nine

Each of these produced a plausible number. Not one produced an error.

| # | the instrument | what it actually measured |
|---|---|---|
| 1 | filmed `page.$("canvas")` | the **2D drawing panel**. 24 identical static frames |
| 2 | `__captureHarness.grab()` with no `enable()` | nothing. Empty PNG |
| 3 | `__revealHarness.seek()` | does not exist. The method is `setProgress` |
| 4 | a lab capture | a blank frame at **ink 0**, reported as "0 differing pixels" |
| 5 | a static frame for the pen tip | the tip is OFF unless mid-reveal, by design |
| 6 | a crop on the canvas bounding box | the **transport bar's caption text**, which pinned the span at `0.927038626609442` across three different camera positions |
| 7 | a 9-second sleep, then screenshot | the words **"Starting the 3D engine"**, reported as 460 ink px |
| 8 | pen-tip pixels with the popover open | the popover, which is 42rem wide and sits over the mark. The "474 px" was its own readout changing from 0° to 80° |
| 9 | every browser gate, all day | a server started with `--webpack`, which this project does not use |

⭐ **The tell in #6 is the one to keep.** A number identical to fifteen decimal places across three
different camera positions is not a measurement. If a value cannot move, it is not watching the
subject.

---

## The ninth is the expensive one and it was a flag

`package.json` says `"dev": "next dev"`, which on this repo is **Turbopack**. `--webpack` came
from a lane note and was never checked against the file. It does two things:

- **breaks the implicit-surface Web Worker**, built through
  `new Worker(new URL("./implicit-surface.worker.ts", import.meta.url))`. `assert-geom-offthread`
  reported a page-level `SyntaxError: Invalid or unexpected token`. With the flag removed: ALL
  ASSERTIONS PASS.
- **kills hot reload.** A token injected into a rendered string never appeared, and the forced
  recompile returned **200 in 0.016s**, a cache hit.

It invalidated a whole browser battery: **30 of 58 gates judged, 11 red, none of them findings.**
And it produced a filed row, F83, which had to be withdrawn.

---

## Three rules came out of the same hour

1. **Start the dev server with the command in `package.json` and nothing else.**
2. **`next dev` takes a lock at `.next/dev/lock`. One per checkout.** Parallel lanes need their own
   copy under `~/.fs-lanes/`.
3. **Never run two batteries, or a battery and a capture, against one server.** Lane C3 measured
   the cost: a fusion capture on a shared server took **58 hot reloads in one 120-cell run and lost
   9 cells outright**; alone on its own port, 0 and 0. It also produced **two false reds** on gates
   that had been green an hour earlier.

And a fourth, found by C3 and worth its own line because it is invisible:
**a bare `touch` with zero content change reddens every stored-evidence gate at once.**
`components/style-panel-scaffold.tsx` had its mtime moved with `git diff` empty, and that alone
turned its gates red on PROVENANCE. **24 of 110 `assert-*.mjs` carry an mtime provenance row and 17
compare against `app/` or `components/`.** Proven with pixels rather than argued: mean |Δ|
**0.00000** across **382** frame pairs, against a positive control scoring 0.50741 on a real code
difference.

⚠ The bumps were mine. Injecting a token into a source file and reverting it restores the content
and moves the mtime.

---

## And the same shape, one level up

`assert-material-craft` was reported as *"PRINTED AN ALL-PASS SUMMARY AND EXITED 0 WITH A SKIP IN
THE OUTPUT"*. It has no skip. It has a control row reading *"every cell skipped for want of
matching files must not print `all checks pass` and exit 0"*, a gate **proving it refuses to sell
a skip as a pass**. `SKIP_RE` tested the whole output as one string and matched the word inside
that control's own label.

**That is this repo's most-repeated defect and this was the fifth:** a guard matching its own
citation comment, the control manifest citing a paragraph *about* a control, `_probe-drawin-film.mjs`
carrying a *"destroying evidence is strictly worse"* note six lines above the code that destroys it,
and a lane's own new comments tripping the detector it had just written. **Prose read as code, every
time.**

---

## What it cost, and what it bought

The meta-gate had been refusing to sweep: **NOT CALIBRATED, 1/41 wrong**, and it says what that
means itself, *"every verdict this file prints is unproven until this is green."* The cause was
seven gates on disk with no manifest entry, six of them added by that day's own work. Registered,
and it came back **CALIBRATED 41/41 across channels A-L** with a real verdict underneath:

```
103 of 111 gates run a negative control on the bare invocation · 7 partial · 1 none
32 FAILURE(S) across channels A-L   →   15 after the day's fixes
```

**The number was invisible while the analyser refused to start.**

⭐ And the rule that survives all of it: **when the numbers disagree with the picture, open the
picture.** Nine instruments said the app was fine. The contact sheet said eighteen frames were the
same frame.

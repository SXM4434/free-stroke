# Travel wrap: the plan

Status: **COMPLETE as a plan. Nothing in the product changed.** Research fork, 2026-09-25, read only.
Prototype and its Node run: `scratchpad/travel/wrap-proto.mjs` (session scratchpad, copied into section 7 below
so the numbers survive the scratchpad).

---

## 1 · What is wrong, measured, from the record

Lane W (`docs/RUN-QUEUE.md`, F118 lane W note, ~line 6486) filmed the looping Travel on a 9-stroke "hellow!" take,
6.2 s, 60 fps, every rAF frame at the seam re-rendered and grabbed.

- **Before** (`docs/verification/night-w/before/summary.json`): travel 25% loop had 13 seam frames under 2% of the
  word's ink, min ink 55 px. Travel 75% loop 8, reverse loop 13, inOut loop 22 of 22.
- **After lane W's change** (`night-w/after/summary.json`): 0 near-empty seam frames in all four, travel 25% seam
  min ink 8298 px against 34142 px for the whole word. Controls did not move: once 29 near-empty (by design),
  loop + 1 s delay 28, grow loop 6.
- **What I saw, `night-w/before/travel25-loop/seam.png`:** frames -20 to -1 show the "!" stem and dot shrinking to a
  dot, ink 1861 falling to 137; frame 0 (p 0.000) is a single speck, ink 55; from +1 the "h" stem grows from a
  sliver, ink 188 at +1 and 2719 by +20. An empty page for about a fifth of a second.
- **What I saw, `night-w/after/travel25-loop/seam.png`:** frames -20 to -1 hold "w!" steady at ink 8500 to 8600,
  the "!" dot arriving at -6. Frame 0 (p 0.000) is "h" plus the first stroke of "e", ink 8414. No empty page, and
  no motion either: the whole segment swaps from the end of the word to its start in one frame. **A hard cut.**
  Lane W said so itself: "No empty page, but a hard CUT from the end of the word to its start. His call."

Measured in Node for this plan (section 7), in the beat's own units, one pass = 373 frames:

| mapping | L | ink length, min to max | largest frame-to-frame change inside a pass | change across the seam |
|---|---|---|---|---|
| once (shipped without loop) | 0.25 | 0 to 0.25 | 0.0068 | 0.0034, but the page is empty |
| lane W `seamless` (shipped with loop) | 0.25 | 0.25 to 0.25 | 0.0041 | **0.5000**, the whole segment |
| true wrap (prototype) | 0.25 | 0.25 to 0.25 | 0.0054 | **0.0054**, same as any frame |
| lane W `seamless` | 0.75 | 0.75 to 0.75 | 0.0014 | **0.4987** |
| true wrap | 0.75 | 0.75 to 0.75 | 0.0054 | **0.0054** |

"Change" is the length of the symmetric difference between two frames' windows. On the hero word (12 strokes,
`scripts/capture/logo-strokes.json`) at overlap 1, lane W's seam jumps from 5.4% of the word's arc on screen to
49.4% in one frame. The true wrap holds 5.4% on both sides.

Two more things lane W's change left behind, found while mapping, **not filmed**:

- **Two different windows exist while a take loops.** The `seamless` flag is added inside `Scene`
  (`components/viewport-3d.tsx:8325-8334`), but `Viewport3D` (from line 9818) still holds the raw one. So
  `__revealHarness.windowAt` (`:11126`) returns the once-through shape while the screen draws the seamless one;
  `__fsWindow.at` (`:8593`, inside Scene) returns the seamless one. A probe that reads the harness is measuring a
  mode nobody is in.
- **Export believes a looping Travel starts and ends on empty paper.** `revealEndsFor(revealWindow.mode)`
  (`:12209`, `:12506`) reads the raw window, and `REVEAL_WINDOW_ENDS.travel` is `{ at0: "empty", at1: "empty" }`
  (`lib/export/frame-plan.ts:110-115`). The rest playhead after an undo is `1 / (1 + L)` (`:10905-10912`), the
  once-through end, which under `seamless` is not the end.

## 2 · Why, with file:line

The window is ONE interval `[lo, hi]` in the beat's space (`lib/stroke-schedule.ts:413-446`). Travel's head runs
`d * (1 + L)` once through (`:428`), so it starts and ends empty. Lane W's `seamless` runs it `L + d * (1 - L)`, so
it is full length on every frame but sits at `[1-L, 1]` on the last frame and `[0, L]` on the first. A true wrap
needs the tail still leaving the end while the head enters the start: `[0, h] ∪ [1-(L-h), 1]`. One interval cannot
say that, and every consumer below reads exactly one.

### Every consumer of the window

| # | consumer | file:line | what it reads | what a wrapped window needs |
|---|---|---|---|---|
| 1 | the pure function | `lib/stroke-schedule.ts:413-446` | makes `lo, hi, openBack, whole, empty` | a second part |
| 2 | the per-stroke spans | `lib/stroke-schedule.ts:985-1030` `strokeSpansIn(sched, lo, hi)` | one `[lo, hi]` | called once per part; the caller merges |
| 3 | the rebuild clip (Solid, Extrude, Inflate loft) | `lib/stroke-schedule.ts:1226-1240` `filterStrokesBySchedule`, called at `components/viewport-3d.tsx:8648-8652` | `win.lo, win.hi` | one piece per part per stroke |
| 4 | the frame loop's live window | `viewport-3d.tsx:5934-5935` `winNow` | whole window | unchanged, it just carries the new field |
| 5 | Rod per-stroke spans | `viewport-3d.tsx:6084-6085` | `strokeSpansIn(sched, winNow.lo, winNow.hi)` | a second spans array for the second part |
| 6 | pen-tip fragment uniforms | `viewport-3d.tsx:6554` (`wants = !winNow.whole`), `:6564` (`d = hi`), `:6596-6597` (`w0 = lo`, `trailOn`) | one leading and one trailing edge | the same two edges, combined as OR instead of AND |
| 7 | pen-tip shader | `viewport-3d.tsx:2594-2595` (uniforms), `:2722-2726` (trailing test, `min`), `:2745` (cache key `fs-pentip-v3`) | `fsWhen <= d AND fsWhen >= w0` | `OR` when wrapped: `max` instead of `min`, one uniform, cache key v4 |
| 8 | Inflate implicit drawRange (sorted `revealKeys`) | `viewport-3d.tsx:6694-6798`, two binary searches, `setDrawRange(loIdx, hiIdx - loIdx)` at `:6798` | one contiguous index range | two index ranges: `[0, idx(hi))` and `[idx(wrapLo), N)` |
| 9 | Rod tube per stroke | `viewport-3d.tsx:6836-6870` (`schedF0`, `schedF`, empty and whole tests), `:6988-7009` (`ringStart`, `setDrawRange` at `:7009`), `:7027` (start cap), end cap `:7030-7037`, joints after | one ring range per tube | two ring ranges on a stroke whose track crosses both parts (overlap > 0 only; measured 1 of 12 hero strokes at overlap 1, 0 at overlap 0) |
| 10 | take timeline strip | `components/take-timeline.tsx:345-347` (`win`, `loC`, `hiC`), `:359-360` (edge hairlines), `:423-424` (inked part of each bar) | `win.lo, win.hi` | inked part per window part; one more hairline |
| 11 | window readout for probes | `viewport-3d.tsx:8586-8595` `__fsWindow` | whole window | carries the field |
| 12 | revealHarness | `viewport-3d.tsx:11126` | raw window, **not** seamless today | must read the same effective window as Scene |
| 13 | export ends | `viewport-3d.tsx:12209`, `:12506`, `lib/export/frame-plan.ts:110-128` | window mode name | a looping Travel is `partial` at both ends |
| 14 | rest playhead | `viewport-3d.tsx:10905-10912` | once-through formula | the effective window's own end |
| 15 | the signature | `lib/stroke-schedule.ts:449-450` `windowSig` | `:seamless` suffix | unchanged |
| 16 | summary line | `lib/stroke-schedule.ts:1381-1396` `describeDrawIn` | mode and length | unchanged |
| 17 | gates and probes that read `lo`/`hi` off the harness | `scripts/verify/assert-export-window.mjs`, `assert-stroke-schedule.mjs`, `assert-take-persists.mjs`, `assert-drawin-pentip.mjs`, `assert-export-plan.mjs`, `_probe-pentip-ribbon.mjs` | `lo, hi` | the second part, or they measure half a window |

**Not consumers, checked:** `lib/flat-ink.ts`, `lib/pen-reveal.ts` and `lib/hero-motion.ts` have zero reads of
`windowAt` or `revealWindow` (`/usr/bin/grep -rn` over `lib components app`). Flat ink reaches the reveal only
through `revealDistanceFraction`, which is the playhead-to-distance law, not the window. `doc-store.ts` and
`style-system.ts` persist `RevealWindowParams` and never evaluate it; `seamless` is runtime only (`:282-283`).

### Silent degradation, the five questions, per consumer

The dangerous one is a consumer that does not know about the second part and draws something plausible.

1. **If the second part were missing, what happens?** Consumers 3, 5, 8, 9, 10 and 17 draw only the head part. At
   the seam that is the word's first letters growing from nothing, with the tail gone: an empty-ish page again,
   drawn confidently. Consumer 7 with the old `min` draws `fsWhen <= b AND fsWhen >= a` with `a > b`: **nothing at
   all** inside the tip field box. Consumer 12 already shows the problem today.
2. **What is the corpus of the check?** Every `windowAt(` call site plus every reader of `RevealWindow.lo`. The
   static gate in section 6 lists them and names what it cannot see (a probe that recomputes the window in its own
   code).
3. **Has it failed?** The must-fail arms in section 6 are built for each consumer.
4. **Can it look healthier by seeing less?** Yes: an ink count at the seam goes UP if the tail part is dropped and
   the head part is drawn at full length by mistake. So the film gate compares against a reference frame, not an ink
   threshold (section 6, the set identity).
5. **What state moves on the failure path?** The Solid rebuild's hole streak (`SolidAnimationTick`, lane S2 note)
   counts consecutive matching builds; a two-piece stroke is a new stroke list, so the streak resets at each seam.
   Harmless, stated so nobody reads it as a bug.

## 3 · Options researched, with sources

**How others wrap a path reveal.** All three references do the same thing: keep ONE start and ONE end, take them
modulo the path length, and when they wrap, draw two segments.

- **Lottie (lottie-web), Trim Paths with offset.** `player/js/utils/shapes/TrimModifier.js`,
  https://github.com/airbnb/lottie-web/blob/master/player/js/utils/shapes/TrimModifier.js (fetched raw from
  https://raw.githubusercontent.com/airbnb/lottie-web/master/player/js/utils/shapes/TrimModifier.js). Used for the
  exact rule. `processShapes` adds the offset to start and end (`o = (this.o.v % 360) / 360`, `s = this.s.v + o`)
  and swaps them if `s > e`. `addShapes` then branches: `if (shapeE <= 1)` one segment `[s, e]`; `else if (shapeS
  >= 1)` one segment `[s-1, e-1]`; else **two segments, `{ s: s, e: total }` and `{ s: 0, e: e - 1 }`**. That third
  branch is the true wrap, and it is the design below. The same file's comment on `m === 2` ("paths are trimmed
  individually so edges need to be found for this specific shape relative to whole group") is the mode that trims
  one window across the combined length of all shapes, which is what this repo's single word-wide window already
  is (`lib/stroke-schedule.ts:266-273`, "ONE WINDOW FOR THE WORD").
- **After Effects, Trim Paths Offset.** Adobe's own page (https://helpx.adobe.com/after-effects/using/shape-attributes-paint-operations-path.html)
  returned 403 to the fetch tool, so I did not read it. Used instead, and weaker for it: the search summary of
  https://blog.motionisland.com/after-effects-trim-paths/ and
  https://wedesignmotion.com/motion-design-how-tos/how-to-use-trim-paths-on-shapes-in-after-effects/ : Start and
  End set the visible piece, Offset shifts both along the path, on a closed path the visible piece wraps around, and
  the looping idiom is an expression `time * 100` on Offset. Used only to confirm that Offset (move both edges
  together, modulo) is the animator's name for this move. Lottie is the exported form of the same property, so its
  code is the primary source here.
- **SVG `stroke-dasharray` / `stroke-dashoffset`.** W3C SVG Strokes, https://www.w3.org/TR/svg-strokes/#StrokeDashing :
  "The resulting even-length dashing pattern is repeated along each subpath", a negative offset behaves as
  `d = s - (abs(stroke-dashoffset) mod s)`, and "The dashing pattern is reset and begins again at the start of each
  subpath." MDN, https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dashoffset , for the
  offset's direction. Used for two things. First, the wrap comes free in SVG because the pattern repeats: a dash of
  `L` with a gap of `total - L` has period `total`, so a dash that runs off the end is followed by the next one
  entering at the start, which is the two-part window by construction. Second, the reset per subpath is a warning:
  a word is many subpaths, and dashing each one resets, so SVG's free wrap is per stroke, not per word. The window
  here is word-wide, so it has to split explicitly, as Lottie does.
- **three.js, drawing two index ranges.** https://threejs.org/docs/pages/BufferGeometry.html : `groups` are
  "rendered in a separate draw call", used with a material array; `drawRange` is one range. Checked in the
  installed three 0.175.0: `WebGLRenderer.js:1126-1132` intersects `drawRange` with each group, and groups are
  only walked when `Array.isArray(material)` (`:1785-1791`). Used to rule the options below.

**The options for the two-range consumers (8 and 9):**

| | how | cost | risk |
|---|---|---|---|
| A. geometry groups | `mesh.material = [mat]`, two groups per wrapped frame | per frame only | every line that reads `mesh.material` as one material (colour, uniforms, the per-letter pass) sees an array. Wide and quiet. |
| B. doubled index buffer | index buffer stored twice, a wrapped window is one contiguous range `[idx(a), N + idx(b))` | 2x index memory, build and `permuteTriangles` re-sort must write both copies | every `setDrawRange(0, totalIndices)` "whole" call draws both copies: double blending on any transparent ink. Silent. |
| C. twin mesh | a second `Mesh` whose `BufferGeometry` shares the SAME attribute and index objects (uploaded once) with its own `drawRange`, same material, same parent | one invisible object per mesh; visible only on wrapped frames | additive: when not wrapped the twin is `visible = false` and the shipped path is untouched |
| D. hull range plus fragment discard | draw `[0, N)`, cut by the tip field | none | the tip is `off`-able and its box leaves coverage 1 outside (`:2727-2729`), so a wrapped window with the tip off would draw the whole word. Silent. |

**The options for the window's shape:**

| | shape | what an unaware consumer does |
|---|---|---|
| a. `lo > hi` means wrapped (the Lottie convention) | no new field | reads `empty: hi <= lo` and draws **nothing**. The worst failure, and it looks like a blank page, the bug lane W removed. |
| b. `parts: [lo, hi][]` | an array | has to be rewritten everywhere; `lo`/`hi` become ambiguous |
| c. one field, `wrapLo`: the window also holds `[wrapLo, 1]`; `1` means no second part | one number | draws the head part only. Still wrong, but the gate in section 6 catches it by name, and the pure function stays byte-equal for every other case |

## 4 · The recommended change, and its risk

**The smallest two-part window: one number on `RevealWindow`, one helper, one place that decides it.**

1. `lib/stroke-schedule.ts` `RevealWindow` gains `wrapLo: number` (1 = no second part). `windowAt`'s travel branch
   under `seamless` runs the head `h = d` and the tail `h - L`: `lo = max(0, h - L)`, `hi = h`,
   `wrapLo = h - L < 0 ? 1 + (h - L) : 1`. At `d = 0` the window is `[1-L, 1]` and at `d = 1` it is `[1-L, 1]`:
   the seam frame is the same set, so a loop is continuous. Every other mode and the once-through travel are
   unchanged (prototype: 0 of 6416 windows differ from the real `windowAt`).
2. One helper beside it, `windowParts(win): [number, number][]`, one or two parts. Every consumer loops over it.
   That is Lottie's third branch as a function.
3. One decider for `seamless`: `effectiveWindow(params, { loop, delaySeconds })` in `lib/stroke-schedule.ts`,
   called ONCE in `Viewport3D` and passed down. Scene's memo at `viewport-3d.tsx:8325-8334` goes away. That fixes
   consumers 12, 13 and 14, which disagree with the screen today.
4. Per consumer:
   - 2, 3: `filterStrokesBySchedule` takes the parts and emits one piece per part per stroke. Pieces of one
     stroke are adjacent in the output.
   - 5, 9: Rod computes one spans array per part. A stroke with one non-empty part takes today's code unchanged.
     A stroke with two uses a twin tube (option C) for the second part. Start cap shows when a part starts at 0,
     end cap when a part reaches 1, joints when inside either part.
   - 6, 7: `d = hi`, `w0 = wrapLo`, and a new uniform `wrapOn`; the shader combines lead and trail with `max`
     instead of `min` when `wrapOn` is 1. Cache key `fs-pentip-v4`. `trailOn` keeps its meaning.
   - 8: two binary searches as today, into two index ranges; the main mesh draws `[0, idx(hi))`, a twin (option C)
     draws `[idx(wrapLo), N)`.
   - 10: each bar's inked part is computed per window part; the `wrapLo` edge gets a hairline like `lo` and `hi`.
   - 13: `revealEndsFor` takes the effective window and returns `partial` at both ends for a wrapping Travel.
   - 14: the rest playhead is `1` under a wrapping Travel (the window at 1 is `[1-L, 1]`, as finished as it gets).
   - 17: every gate that reads `lo`/`hi` off the harness reads `wrapLo` too.

**The design call that is his, not mine.** With a true wrap, the FIRST frame of the first pass already shows the
end of the word (`[1-L, 1]`), before anything has been drawn. Two ways:
- (i) the first pass enters from an empty page like once-through, and the wrap starts at the first seam. Needs a
  pass count in the effective window.
- (ii) every pass, including the first, is the same wrapped pass. Simpler, and a looping take then has no start.
I lean (i) for a drawing app, because the first time you press Play you expect to see it drawn from the start. His
eye decides.

**Also his:** the head's speed changes. Per pass the head travels `1 + L` once through, `1 - L` under lane W, `1`
under the true wrap. At Travel 75% lane W's segment crawls a quarter of the word per pass; the wrap moves the full
word.

**Risk.**
- Low for 1, 2, 3, 6, 7, 10, 13, 14: pure functions and uniforms, byte-equal off the wrap.
- Medium for 8 and 9: the twin mesh must inherit every per-mesh latch (`isForcedHidden`, visibility during the
  turn, the per-letter pass). The lane that builds it must grep every write to `mesh.visible` for these meshes.
- Medium for 3: a two-piece stroke changes the stroke list the Solid mask and hole detection see on wrapped frames.
  The Solid lane's cache work (`docs/research-2026-09-25/solid/PLAN.md`) must key on the parts, not on `lo`/`hi`.
- Cost: the helper is 0.019 µs a call in Node, about a millionth of a frame. The twin adds one draw call per
  wrapped mesh on wrapped frames only.

## 5 · What I did not check

- The After Effects help page itself (403). The AE claim rests on two tutorial pages and on Lottie's code.
- No browser, no film, no gate was run. Every number here is Node, from the prototype.
- Whether the export actually loops a Travel through Scene with `seamless` on. I read the code path, I did not
  export a file.
- The twin mesh against the per-letter pass (`FS_LETTER_MAX`, `:2757`), which reads the mesh's place in the word.
- Reverse and the four eases under the wrap. `windowAt` takes the eased playhead, so the wrap composes, but an
  `inOut` ease puts zero speed at the seam, and that may read as a hold.

## 6 · TEST PLAN for a build lane

Everything runs on the lane's own clone and its own dev server port, with its own headless Chrome, its own
profile directory and port, killed by exact pid. Never his browser.

### 6.1 Node, before any browser (no server)
- `wrap-proto.mjs` promoted to `scripts/verify/assert-window-wrap.mjs`, importing the REAL lib through jiti:
  - **W1** every non-wrapping window is byte-equal to the pre-change `windowAt` over 4 modes × 4 lengths × 401
    playheads (prototype: 0 of 6416). Must-fail: drop the `seamless` guard, all travel rows fail.
  - **W2** under a wrapping Travel, ink length is `L` at every one of 373 frames, and the window at `d = 0` equals
    the window at `d = 1` as a set. Must-fail: run W2 against lane W's mapping; the seam change must read 0.5 at
    L 0.25 and fail.
  - **W3** seam change equals the pass's median frame change within 10%. Prototype: 0.0054 against 0.0054.
    Must-fail: lane W's 0.5.
  - **W4** on the hero word at overlap 0 and 1, the sum of per-part `strokeSpansIn` arc is continuous across the
    seam (prototype: 0.054 to 0.054 at overlap 1; lane W 0.054 to 0.494 must fail).
  - **W5** `filterStrokesBySchedule` with a wrapped window returns pieces whose total arc equals W4's.
- **W6, the static consumer gate** `assert-window-parts-consumers.mjs`: lists every `windowAt(` call and every
  read of `.lo` on a `RevealWindow` in `lib components app scripts/verify`, and fails any that has no
  `windowParts(` or `wrapLo` in the same function unless it is on an allowlist with a reason. It prints its
  denominator. Positive control: plant a call site without `windowParts` in a temp copy of `take-timeline.tsx`
  and show the gate names it. It cannot see a probe that recomputes the window in its own arithmetic; say so in
  the gate.

### 6.2 In the page (dev and one prod arm)
- **P1, the set identity.** `assert-stroke-schedule` already holds `travel = P(hi) \ P(lo)` against two `grow`
  frames. Add the wrap row: a wrapped Travel frame equals, pixel for pixel, the union of `grow` at `hi` and
  `vanish` at `wrapLo` (`vanish` at d is exactly `[d, 1]`). Per engine: Rod, Solid, Extrude, Inflate Auto, Inflate
  Loft; tip on and tip `off`. Must-fail: the same row with the shader still on `min` must show the tip box empty;
  with the twin disabled, the tail part missing.
- **P2, the harness agrees with the screen.** `__revealHarness.windowAt(d)` and `__fsWindow.at(d)` return the same
  window at 9 playheads with loop on and off. Must-fail today: loop on, they differ (consumer 12).
- **P3, export.** `assert-export-window.mjs` gains the row: looping Travel, ends `partial` / `partial`, and the
  plan keeps its hold. Must-fail today: it reads `empty`.

### 6.3 Gates to re-run, before and after, diffed row by row
`FS_PORT=<port> node scripts/verify/assert-export-window.mjs` (39/0 before, `night-w/gates-before/`),
`assert-drawin-timing.mjs` (25/25), `assert-take-timeline.mjs` (20/0), `verify-timing-origin.mjs --label=wrap-after`
then `assert-timing-frames.mjs --label=wrap-after` (30/0), `assert-stroke-schedule.mjs`, `assert-drawin-pentip.mjs`,
`assert-take-persists.mjs`, `assert-export-plan.mjs`, `assert-eye-draw-reads-written.mjs` (lane W did not run it).
Every row that moves is named in the ledger with the reason.

### 6.4 Films, with lane W's rig
`docs/verification/night-w/film-windows.mjs`, same word, same take, same crop, labels `wrap-before` (the current
hard cut) and `wrap-after`.
- Cases: travel 25% loop, travel 75% loop, travel 25% loop reverse, travel 25% loop inOut, on Rod and on Solid.
- Controls that must not move: travel 25% once (29 near-empty at the end), travel loop + 1 s delay (28), grow loop
  (6).
- New metric beside `seamNearBlank2pct`: **seam pixel change**, the XOR pixel count between frame -1 and frame 0,
  against the median XOR of the 40 frames around it. Bar: the seam frame's XOR is at most 2x the median. lane W's
  after sheet must FAIL this bar (whole segment swaps), and that failure is the must-fail arm.
- Open `seam.png` for every case, and write what the frames show, the way section 1 does.
- One real-time mp4 of travel 25% loop, before on top and after underneath, for him. He grades it; nothing here is
  "fixed" until he does.

## 7 · The prototype, and its output

`scratchpad/travel/wrap-proto.mjs`, run 2026-09-25 against the real `lib/stroke-schedule.ts` through jiti:

```js
function windowAtWrap(p, playhead) {
  if (!(p.mode === "travel" && p.seamless)) return { ...windowAt(p, playhead), wrapLo: 1 }
  const d = playhead < 0 ? 0 : playhead > 1 ? 1 : playhead
  const L = Math.max(WINDOW_MIN_LENGTH, Math.min(1, p.length))
  const tail = d - L
  const lo = tail > 0 ? tail : 0
  const hi = d
  const wrapLo = tail < 0 ? 1 + tail : 1
  return { lo, hi, wrapLo, openBack: !(lo > 0), whole: false, empty: hi <= lo && wrapLo >= 1, identity: false }
}
function windowParts(w) {
  const out = []
  if (w.hi > w.lo) out.push([w.lo, w.hi])
  if (w.wrapLo < 1) out.push([w.wrapLo, 1])
  return out
}
```

```
label            L     minLen  maxLen  maxStepXor  seamXor  seamFirstLen
once             0.25  0       0.25    0.0068      0.0034   0
laneW-seamless   0.25  0.25    0.25    0.0041      0.5      0.25
true-wrap        0.25  0.25    0.25    0.0054      0.0054   0.25
once             0.75  0       0.75    0.0094      0.0047   0
laneW-seamless   0.75  0.75    0.75    0.0014      0.4987   0.75
true-wrap        0.75  0.75    0.75    0.0054      0.0054   0.75
non-seamless regression: 0 of 6416 windows differ from lib windowAt
hero word, overlap 0: 12 strokes, 12 tracks. true-wrap last 0.250 -> first 0.250; laneW 0.250 -> 0.250; two-span strokes at d=0.1: 0
hero word, overlap 1: 12 strokes, 12 tracks. true-wrap last 0.054 -> first 0.054; laneW 0.054 -> 0.494; two-span strokes at d=0.1: 1
windowAtWrap + windowParts: 0.019 us per call
```

At overlap 0 lane W's ink fraction holds across the seam (0.250 both sides) because the segment is full length on
both frames; what jumps is WHERE it is, which the seam XOR row above measures. The hero strokes were given synthetic
timestamps (8 ms per point); only arc length matters to `strokeSpansIn`.

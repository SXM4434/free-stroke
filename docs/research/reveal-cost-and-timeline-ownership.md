# Reveal cost, and who owns the beat

Research behind the hero-page pass of 2026-07-30. Two questions, measured before
anything was changed:

1. **Where does the 1.1s stall actually live**, and which of the four candidate
   fixes (build at mount / build progressively / cache by stroke signature /
   drop resolution during the beat) survives contact with the numbers?
2. **What does it take for a timeline library to own a beat** without becoming
   the codebase's next pair of drifting sources of truth?

---

## 1. The stall

### 1.1 Measuring it without a browser

`polygoniseCapsuleField` is pure JS: an acceleration grid, an SDF sampled on a
uniform lattice, marching cubes, a gradient-normal pass and a manifold audit.
Not one line of it touches WebGL, the DOM or a canvas, and
`lib/geometry-engines.ts` loads verbatim under `scripts/verify/_ts-load.mjs`.
Node and Chrome run the same V8.

So the cost split is measurable in node — `scripts/verify/measure-implicit-cost.mjs`
— at a hundred sample points, with no compositor, no rAF throttling and no React
in the signal. The browser still has to say whether the beat READS right; it is
a bad instrument for saying which line costs what.

### 1.2 The measurement

Hero word ("Desk Doodles", 22 strokes, 1030 processed points), the page's own
`resolution: 5`, `blend: 0.45`:

```
 reveal   wall(ms)   grid    march  normals   +audit   grid dims      active     sdfEvals
  0.05       24.5     0.0     14.9      8.1      1.4    37x102x19     37,206    1,020,070
  0.25      121.2     0.0     68.0     43.0      9.8   176x112x20    167,744    8,019,351
  0.50      246.7     0.1    141.9     94.5      9.6   260x125x20    302,983   16,421,909
  0.75      372.4     0.1    211.7    141.5     18.4   413x140x20    473,401   24,766,625
  1.00      531.5     0.1    293.7    205.3     31.5   522x140x21    606,162   34,904,719
```

Three things fall out immediately, and each one kills a candidate fix.

**It is a RAMP, not a cliff.** full/half = 2.15×; the cost is linear in revealed
arc length. The brief's framing — "builds at full complexity the instant the
draw-in completes" — describes the worst tick, but every tick is paying. At five
percent of the word a rebuild already costs 24ms, over a 60fps frame.

**One draw-in asks for ~120 of them inside 2.6 seconds.** At the measured mean
that is about 31 seconds of build work inside a 2.6-second beat. The reason the
page did not appear to be 12× over budget is that the work is self-limiting: the
reveal only advances on a rendered frame, so a slow build starves its own
successor. What a viewer saw was the LAST one, at full word, uninterrupted —
the 1.1s freeze.

**The split is march 55% / normals 39% / audit 6% / acceleration grid ~0%.**
The grid is free. The cost is field evaluation: ~35M exact round-cone SDF calls
at reveal 1, of which the normal pass is six per output vertex.

### 1.3 Cost against the resolution dial

```
  res    wall(ms)   grid dims        cells      alloc(MB)   vs res5
   3       161.4    314x 85x13     346,970          6.5      0.30x
   4       319.6    418x113x17     802,978         14.7      0.60x
   5       549.5    522x140x21   1,534,680         27.8      1.04x
   6       812.0    626x168x24   2,524,032         45.4      1.53x
   8      1681.5    834x223x31   5,765,442        102.5      3.17x
```

Roughly `res^2.5`. The hero pins 5; the lab was showing 8.

### 1.4 Why each candidate fix fails on its own

- **Drop resolution during the beat, refine after.** The floor is
  `INFLATE_RESOLUTION_MIN = 2`. Even `res 3` costs 158ms for the full word —
  ten frames. A beat cannot hitch ten frames immediately before its centrepiece
  and still have a tempo. Buys 3.3×; needs 30×.
- **Cache by stroke signature.** Two consecutive identical builds measured
  523.6ms then 530.8ms — there is no cache at all today, so this is real. But it
  only helps on a REPEAT. The first play of a page still pays in full, and the
  first play is the one a visitor sees.
- **Build at mount.** Solves the settle and does nothing for the draw-in, which
  by construction needs a *different surface every tick*.
- **Build progressively.** That is what it already does. It is the defect.

### 1.5 What the numbers actually say

No amount of making the rebuild cheaper reaches a frame budget. The rebuild has
to stop happening — and this codebase already knew how, because **Rod has never
rebuilt anything**: it orders its tube rings by arc length at build time and
animates with `setDrawRange` and a binary search (`viewport-3d.tsx`, the
`ringArcFracs` block).

The reveal is not a geometry problem. It is a rendering problem.

Marching cubes does not hand you an arc-length ordering, so one has to be
derived. The mechanism landed in `lib/implicit-surface.ts` §6:

- each output vertex is keyed to the arc position of its NEAREST capsule
  (`CapsuleField.nearestIndex`, reusing the same bucket walk `eval` uses);
- each triangle takes the **max** over its three vertices — max, not mean, so no
  triangle can appear before the pen has passed all of it;
- the index buffer is counting-sorted into ascending key order (4096 buckets,
  keys already bounded to 0..1; a comparator sort of 147k triangles costs more
  than the marching did), then the key array is clamped monotone so a binary
  search over it is valid and conservative.

Measured surcharge: **39ms, once**, on a build that already costs 600ms and now
happens once instead of ~120 times.

### 1.6 The one visible cost, and why it does not show

The leading edge becomes a cut through the finished surface rather than a
rounded pen tip: the cap triangles at a stroke's far end sort last. Three things
make it a non-event here.

1. It is one stroke-width wide and it is moving.
2. It only exists during the draw beat. By the time the mark gains depth the
   reveal is complete and the surface is whole — and provably the same surface,
   see below.
3. The mark is driven to near-zero depth for the whole of draw and breath, so
   the cut has essentially no extent to show.

Checked on frames, not argued: `docs/verification/hero-transition/drawrange/scrub/`,
and a 3× crop of the pen tip at mid-draw shows a clean solid stroke end.

### 1.7 What had to be proved, not asserted

A reveal that runs backwards, or pops whole strokes, or leaks triangles ahead of
the pen would still be fast and would still look like "something is being
drawn". `scripts/verify/assert-implicit-reveal.mjs` compares the two mechanisms
against each other on the property that defines a reveal — **which part of the
plane is inked** — at six playhead positions:

```
 playhead   rebuild maxX   drawRange maxX   delta (% of word width)
   0.15       -0.7707        -0.7707          0.00%
   0.30       -0.0710        -0.0897          0.47%
   0.45        0.3393         0.3400          0.02%
   0.60        1.1803         1.2012          0.52%
   0.75        1.8138         1.8161          0.06%
   0.90        2.3162         2.3114          0.12%
```

Worst 0.52% of the word width — about a tenth of a letter.

It also proves the surface itself is untouched: same positions byte-for-byte,
same normals byte-for-byte, same SET of 147,452 triangles, only reordered. That
matters beyond tidiness — every measurement this project takes on the Inflate
surface (the fillet law, the manifold audit, the rim metrics) would silently
have been measuring a different object otherwise.

And it carries a **negative control**: the same comparison run with the reveal
keys deliberately reversed, which must FAIL. It does, at 100%. An agreement test
that cannot fail proves nothing.

### 1.8 Result in real time

Played through the page's own Play button, headed Chrome on Metal, every rAF
interval recorded (`scripts/verify/verify-hero-page.mjs`):

| | before | after |
|---|---|---|
| worst frame | ~1100ms | **16.7ms** |
| median frame | — | 8.3ms |
| frames over 100ms | ≥1 | **0** |
| frames rendered on the 0.54s emerge | 0 (skipped) | **65** |

---

## 2. Timeline ownership

### 2.1 The constraint

DialKit's dock is the right surface for this — dragging a clip bar retimes a
beat directly, which is how choreography is tuned. The risk is that it becomes
the fourth instance of this codebase's dominant bug: two things holding the same
value until they quietly stop agreeing. (The two mirrored register/engine pills;
the viewport's 4.6s transport under the page's 10.60s one; the phase readout
that looked like it disagreed with the pose.)

### 2.2 What DialKit actually does with clip values

Read from `node_modules/dialkit/dist/index.js`, because the answer determines
the wiring:

- `useDialTimeline(name, config, opts)` turns `at` and `duration` into **dials
  in the DialStore**. The config supplies DEFAULTS; the store owns live values.
- `DialStore.reconcileValues` **preserves an existing value** when the config's
  default changes. So a changed default cannot push a new `at` into the store —
  values only move by user action or by an explicit `DialStore.updateValue`.
- Every clip's `at` is independent of its neighbours' durations. Dragging clip
  3's edge does not ripple clips 4–8.
- `TimelineStore.tick` advances on a **raw, unclamped** `now - lastTick`.

The last point is why the two jobs are one job. The page's old rAF loop carried
a `MAX_STEP = 0.25` clamp whose entire purpose was to stop the 1.1s stall from
skipping the 0.54s emerge. Handing the clock to a library with no such clamp
would have reintroduced the skipped beat on the first frame that ran long.
**The stall had to die before the timeline could own the playhead.**

### 2.3 The wiring

- Eight phases → eight clips, `at` and `duration` from `DEFAULT_HERO_MOTION.beats`.
- `HeroBeats` is **derived** from `tl.<phase>.duration`. The page holds no copy:
  its state is `Omit<HeroMotionParams, "beats">`, so a second copy is not merely
  discouraged, it is unrepresentable.
- The playhead is `tl.time`; play/pause/seek are `tl.play/pause/seek`. The
  page's rAF loop is gone.
- `at` is derived, not authored. The eight phases are strictly sequential and
  `lib/hero-motion.ts` lays them out by cumulative sum, so the page writes that
  cumulative sum back into the store whenever it disagrees. Dragging any clip's
  edge therefore ripples the clips after it, which is what a sequential beat
  should do; dragging a clip's BODY snaps back, which is correct — there is no
  meaning to moving a phase without reordering, and the order is fixed in
  `HERO_PHASES`.
- The panel's Beats section has **no sliders**. It reports the live durations and
  says where to drag. A slider beside a clip bar is two controls over one number.

### 2.4 The one rough edge, named

DialKit sizes its ruler to `max(the config's own total, the furthest clip end)`.
Lengthening the beat extends the ruler; shortening it below the captured 10.2s
leaves a dead tail on the dock. The page therefore takes its `total` from
`totalDuration(played)` — the sum of the eight clips — and clamps the transport
there, so the tail is unreachable through the page's own controls. It is still
visible on the dock's ruler.

### 2.5 Verified through the UI

`scripts/verify/verify-hero-page.mjs`, headed, drives the real dock: it locates
the ORBIT clip by DialKit's own `title` attribute, grabs its
`.dialkit-timeline-clip-handle[data-edge="end"]`, drags it, and requires the
PAGE's own duration readout and the transport's total to follow — 3.20s → 2.08s,
total 10.20s → 9.08s. Then "Revert to captured values" restores both.

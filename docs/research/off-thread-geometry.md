# Getting the implicit build off the main thread

Research behind the performance pass of 2026-08-01. The question: **why does
touching a dial freeze the page for a second, and which of the five candidate
fixes survives contact with a profile?**

Everything here was measured on the real page. Where a number is quoted from
somewhere else it says so.

---

## 1. The defect, and the first correction to the record

### 1.1 What it costs

`scripts/verify/_probe-dial-latency.mjs`, `/desk-doodles`, Free Stroke engine,
headless Chrome on Metal at 1600×1600 dpr 2, `PerformanceObserver` longtask plus
a rAF-gap sampler, with an idle control:

| gesture | long tasks | blocked | worst frame gap |
|---|---|---|---|
| idle control | 0 | 0 ms | 10 ms |
| wobble nudge at rest | 2 | 809 / 927 / 923 ms | 808 / 933 / 925 ms |
| wobble nudge while playing | 2 | 852 / 839 / 812 ms | 858 / 842 / 825 ms |
| wobble **drag**, 8 steps | 14 | **5780 ms** | 833 ms |

### 1.2 The dispatch brief's control does not reproduce, and that matters

The brief carried Desk Doodles at **17–33 ms** for the same nudge, against Free
Stroke's 1200+, and called it 37×. On a freshly started dev server the Desk
Doodles arm measures **204–297 ms**, and the Free Stroke arm measures 925 ms —
a ratio of 3.6, not 37.

Neither number is wrong; they were taken on different machines-in-time. The
brief's readings came off a `next dev` that had been up three and a half days at
5.4 GB RSS (it deadlocked and was replaced during this pass, §5). **The lesson is
not "the brief was wrong", it is that a ratio between two numbers taken in
different sessions is not a measurement.** Every number in this document comes
from a single run that measures both arms.

The consequence for the work is real: **~200 ms of the freeze was never the
geometry engine at all**, and no amount of work on the polygoniser could have
removed it.

### 1.3 The engine cannot see half of what it costs

`INFLATE_DEBUG.msBuildTotal` — the engine's own stopwatch across
`InflateEngine.buildPreview` — reads **~600 ms** for a gesture the browser
records as **~925 ms blocked**. A fix aimed at that number would have been aimed
at two thirds of the problem and would have reported its own win wrong.

---

## 2. The profile, sampled rather than reasoned about

`scripts/verify/_probe-dial-cpu.mjs` attaches a CDP `Profiler` session at a
0.2 ms sampling interval, profiles one nudge, profiles an equally long idle
window, and subtracts. Self-time per function, net of idle:

```
   net ms   function @ where
    738.6   CapsuleField.sdSegment        lib/implicit-surface.ts
    296.6   CapsuleField.eval             lib/implicit-surface.ts
    291.5   __calibrationBurn400ms        (the probe's own control)
    103.7   buildPenField                 lib/flat-ink.ts      ← NOT geometry
    102.3   performance.now               (native, inside the control loop)
     92.6   polygoniseCapsuleField        lib/implicit-surface.ts
     66.5   nibHalfWidth                  lib/flat-ink.ts      ← NOT geometry
     34.3   sample                        lib/implicit-surface.ts
     33.1   addEdge                       lib/implicit-surface.ts
     25.2   penTaperProfile               lib/flat-ink.ts      ← NOT geometry
     16.1   inflateBuildImplicitGeometry  lib/geometry-engines.ts
     16.0   findHeroJunctions             app/desk-doodles/page.tsx
```

Absolute values are inflated — a 0.2 ms sampler on tight numeric loops costs
roughly 2×, which is why the 400 ms calibration burn reads 291.5 + 102.3 native.
The **attribution** is what the profile is for, and it is unambiguous:

- **~63 % is field evaluation** (`sdSegment` + `eval`). 35 M exact round-cone
  distance calls at reveal 1, ~35 candidates per grid query.
- **~10 % is the pen field**, which is not geometry and lives in another module.
- The march, the audit and the reveal sort together are under 10 %.

---

## 3. The five candidate fixes, priced

| candidate | what it buys | why it is not the answer |
|---|---|---|
| **Lower resolution while dragging** | `resolution: 3` = 158 ms in node, ~320 ms here | Ten frames, on *every step* of a drag. And the storyboard's warning stands: hole thresholds must scale with resolution or topology decisions stop being resolution-independent. Buys 3×; the gap is 60×. |
| **Signature cache** | a revisited value returns in ~2 ms | Does nothing for a value never visited, which is every value the first time. Real, but not a fix — kept as a *layer* (§4.3). |
| **Debounce the drag** | 20 builds → 1 | Turns twenty freezes into one freeze. The single nudge — the measured defect — is untouched. |
| **Analytic normals from the field** | up to 210 ms of the node build | **Ruled out on correctness, not on cost.** Normals are geometry. Anything that changes them changes `geometry-baseline`, the fold census and every rim metric this project has ever taken. A faster build that changes geometry is a regression. |
| **Make `sdSegment` cheaper** | maybe 2× | A provably-lossless bucket cull is available (§6) and worth having, but 2× on 63 % of 925 ms still leaves a 500 ms freeze. |

**None of them makes the page RESPOND.** They make it freeze for less long. The
acceptance is responsiveness, so the answer has to be a different shape: stop
doing the work on the thread that paints.

---

## 4. What was built

### 4.1 The seam

`polygoniseCapsuleField` is pure arithmetic right up to its last five lines,
where it wraps three typed arrays in a `THREE.BufferGeometry`. That wrap is the
only thing a Worker cannot hand back — a BufferGeometry is neither
structured-cloneable nor transferable, `Float32Array` and `Uint32Array` are both.

So the pipeline is split exactly there. `polygoniseCapsuleFieldBuffers` is
everything above the seam; `polygoniseCapsuleField` is the seam plus the wrap,
unchanged for every existing caller. The worker calls the same function the main
thread calls — **one implementation, two threads**. Two implementations of one
build is how "faster" quietly becomes "different".

Byte-identity is then structural rather than hopeful: same V8, same IEEE-754
doubles, same operations in the same order, inputs transferred as `Float64Array`
so nothing is rounded in transit. Packing at `Float32Array` would have been a
real bug — `CapsuleField` narrows to f32 internally, but the active-cell
rasteriser reads `caps[i].ax` as a double, and a rounded read can move a cell
boundary.

### 4.2 The swap cannot go through React, so it goes through three.js

`useStrokeMeshes` is a `useMemo`. Whatever it returns must be returned
synchronously, and **React will not re-render when a worker finishes, because no
state changed.** There is no state to change: the geometry is not state, it is
the memo's output.

So the deferred call hands back *the geometry object that is already on screen* —
the same `THREE.BufferGeometry` instance — and when the worker lands, that
instance's attributes are replaced in place. three.js reads the geometry every
frame, so the new surface appears on the next rendered frame with React never
involved. The mark never blanks: it holds its last good shape and then changes.

This is also what makes the fix implementable without touching
`components/viewport-3d.tsx` at all.

Two details that are not optional:

- **`geometry.dispose()` before swapping attributes.** `WebGLGeometries`
  deletes the GL buffers of the attributes a geometry holds *at dispose time*,
  by walking `geometry.attributes`. Replace an attribute without disposing and
  the old GPU buffer is never freed — ~3.5 MB of VRAM per rebuild, which over a
  session of dragging is its own defect. Disposing and continuing to use the
  object is safe: `WebGLGeometries.get` re-registers any geometry whose id it no
  longer knows, on the next render.
- **`revealKeys` has to be patched by hand.** `AnimatedStrokes` binary-searches
  `StrokeMeshData.revealKeys` every frame, and the table is sized to the triangle
  count. React cannot see the new one, so the slot's completion callback writes
  it onto the live mesh data.

### 4.3 What is deliberately *not* deferred

Every one of these exists so that nothing which reads geometry immediately can
read a stale one:

- **Export.** `buildExport` never touches this path. A GLB is always the full
  synchronous build — which is what keeps `geometry-baseline`'s `exportBytes` an
  honest check rather than a column that cannot move.
- **The first build of a slot.** With nothing on screen to hold, there is nothing
  to defer *to*.
- **Any build not measured expensive.** A slot defers only after one of its
  builds has been observed to cost ≥ 120 ms. Every synthetic fixture in the
  verification battery builds in tens of milliseconds and therefore never leaves
  the synchronous path — the gates see exactly what they saw before. 120 ms is
  seven frames: below it a worker round trip costs more latency than it saves.

The slot key is `canvas dimensions | stroke count`. It identifies *the surface*,
not its dial values — that is the whole point. Wobble, endpoint, blend and
resolution never move it, so a dial change lands on the same slot and the
previous mark can be held; drawing or clearing a stroke always moves it, so a
genuinely different drawing builds synchronously with nothing stale to show.

### 4.4 Coalescing and the cache

A drag emits a step per frame. Only the **newest** superseded request survives,
so an eight-step drag costs at most two builds after the one already in flight
rather than eight. On top of that a three-entry signature cache (LRU, keyed on a
64-bit hash of the packed capsules *and confirmed by a full byte compare*, so a
collision cannot show the wrong mark) makes a value already visited return in
milliseconds. Measured on the 8-step drag: **3 worker builds and 4 cache hits**.

Three entries, not thirty: each is ~3.5 MB on the hero word.

---

## 5. The thing that cost the most time, and it was not the optimisation

Mid-pass, `next dev` stopped compiling. `Ready in 186ms`, then `Compiling / ...`
forever — `/` and `/desk-doodles` both hanging past 25 minutes, **no error
printed anywhere**, and `tsc --noEmit` green at its 51-error baseline throughout.

`sample` on the process showed every `tokio-runtime-worker` in
`next-swc.darwin-arm64.node` parked in `_pthread_cond_wait` at 0 % CPU. Not a
slow compile — a **deadlock**.

Two causes, found in that order:

1. **A stale Turbopack persistent FS cache.** The previous server had been up
   3½ days at 5.4 GB RSS and was hard-killed. Clearing `.next` and restarting
   with `TURBOPACK_PERSISTENT_CACHE=0` gave `GET / 200 in 1162ms`.
2. **A module cycle through a worker entry.** With the server clean, restoring
   `new Worker(new URL("./implicit-surface.worker.ts", import.meta.url))` inside
   `implicit-surface.ts` — which the worker itself imports — hung the compile
   again. Bisected in both directions: expression removed → 200 in 1.16 s;
   expression restored → hang; scheduler moved into its own module so nothing
   points back → 200 in 424 ms.

**The rule this buys, and it is the important part: `tsc --noEmit` is not
evidence that the app builds.** tsc does not resolve worker URLs and does not
walk a bundle graph. It was green through every minute of a build that could not
compile. That is the exact "green row that cannot fail" shape this repo keeps
catching, and it was hiding in the one check everyone treats as the floor.

Hence the file layout, which is load-bearing rather than tidy:

```
implicit-surface.worker.ts  ->  implicit-surface.ts        (no worker reference)
implicit-defer.ts           ->  implicit-surface.ts  +  the worker URL
```

`implicit-surface.ts` must never import `implicit-defer.ts` or name the worker
URL.

---

## 6. Not built, and worth having: a provably-lossless candidate cull

`meanCandidates` is ~35 — every field query evaluates ~35 exact round-cone
distances, and `sdSegment` is 63 % of the build.

Inside a run the fold is a **hard** min, and `Math.min` on floats is exact and
order-independent. So for each candidate, a cheap conservative lower bound
(squared distance to the capsule's bounding sphere, no `sqrt`) that already
exceeds the running run-minimum means the exact evaluation cannot lower it and
can be skipped — **bit-identical output, by the associativity of an exact min**.

The obvious generalisation is *not* safe and the reason is worth recording:
skipping a primitive changes RUN BOUNDARIES, and a run that splits in two is
then `smin`-ed with itself instead of hard-min-ed — a different surface. The cull
must skip the *evaluation*, never the *list entry*.

Estimated 3–5× on the dominant term. Not built here because the worker already
takes the cost off the thread that paints, and a second change to the hot loop
in the same pass would have made the byte-identity proof harder to read.

---

## 7. Sources

The mechanism here is this repo's own; the two external facts it leans on were
read first-hand rather than recalled:

- `node_modules/three/src/renderers/webgl/WebGLGeometries.js` — `onGeometryDispose`
  walks `geometry.attributes` at dispose time and `get()` re-registers an unknown
  geometry. Both halves of §4.2's dispose-then-reuse pattern are read off that
  source, not off documentation.
- Chrome DevTools Protocol `Profiler.start` / `Profiler.stop` sample format:
  `samples[i]` with `timeDeltas[i]` in microseconds. Attributing the delta to the
  sample is what makes the table self-time rather than a sample count, which
  matters precisely because the sampler's interval slips under a one-second
  block.

Prior art in this repo, and it is the closest thing to a precedent:
[`reveal-cost-and-timeline-ownership.md`](reveal-cost-and-timeline-ownership.md)
priced the same field build for the *draw-in* and concluded the rebuild had to
stop happening. This pass is the other half — the rebuild that genuinely cannot
be avoided, because the user changed the shape.

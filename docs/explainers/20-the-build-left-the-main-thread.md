# 20 — The build left the main thread, and the typecheck could not see the break

Research: `docs/research/off-thread-geometry.md`.

Every dial touch froze the app for a second. Fixing it took a worker, and the
worker took a deadlock with it — one that `tsc` was structurally unable to
notice.

---

## 1. The freeze

Explainer 18 killed the 1.1 s stall in the *draw-in* by making the reveal a
`setDrawRange` over an arc-length ordering, so the surface is built once instead
of ~120 times. That left the rebuild that genuinely cannot be avoided: **the one
where the user changed the shape.**

Measured on `/desk-doodles`, Free Stroke engine, real dial, longtask + rAF gap,
idle control, three repetitions:

| gesture | long tasks | blocked | worst frame gap |
|---|---|---|---|
| idle control | 0 | 0 ms | 10 ms |
| wobble nudge at rest | 2 | 853 / 939 / 904 ms | 859 / 942 / 900 ms |
| wobble nudge while playing | 2 | 868 / 847 / 829 ms | 875 / 858 / 833 ms |
| wobble **drag**, 8 steps | 14 | **5847 ms** | 842 ms |

Nearly six seconds of frozen main thread for one slider drag.

## 2. The first thing the profile said was that the brief was measuring wrong

The dispatch carried Desk Doodles at 17–33 ms for the same gesture, making the
gap 37×. On a freshly started dev server the Desk Doodles arm measures
**204–297 ms**. The brief's readings had come off a `next dev` that had been up
three and a half days at 5.4 GB RSS.

Neither figure is a lie; the ratio between them is. **A ratio between two numbers
taken in different sessions is not a measurement**, and the probe was rewritten
to take both arms in one page load — the parked prior (`law.mode = "sync"`) and
the shipped default, same browser, same wall clock, same code doing the timing.

That correction changed the work. It says ~200 ms of the freeze was **never the
geometry engine**, so no amount of work on the polygoniser could have removed it.

## 3. And the engine could only see two thirds of its own cost

`INFLATE_DEBUG.msBuildTotal` reads ~600 ms while the browser records ~925 ms
blocked. So the number the engine publishes about itself is not the number a
human feels, and a fix chosen off it would have been aimed at the wrong two
thirds — then reported its own win against the same short ruler.

The attribution came from V8 instead, via a CDP sampling profiler with an idle
window subtracted (`_probe-dial-cpu.mjs`):

```
738.6 ms  CapsuleField.sdSegment      the exact round-cone distance
296.6 ms  CapsuleField.eval           the bucket walk + run folding
103.7 ms  buildPenField               lib/flat-ink.ts   ← not geometry at all
 92.6 ms  polygoniseCapsuleField      marching, allocation, sorting
 66.5 ms  nibHalfWidth                lib/flat-ink.ts   ← not geometry at all
```

Two thirds is field evaluation. A tenth is the *pen* field, in a different
module, doing the same kind of work for a different reason.

## 4. Why none of the cheap fixes were taken

`resolution: 3` still costs ~320 ms here — ten frames, on every step of a drag.
A cache does nothing for a value never visited, which is every value the first
time. Debouncing turns twenty freezes into one freeze. Analytic normals would
have paid for themselves and were **ruled out on correctness, not cost**: normals
are geometry, and a faster build that changes geometry is a regression.

All of them make the page freeze for less long. None makes it *respond*. So the
answer had to change shape: stop doing the work on the thread that paints.

## 5. The seam, and why the output is identical rather than close

`polygoniseCapsuleField` is pure arithmetic until its last five lines, where it
wraps three typed arrays in a `BufferGeometry`. That wrap is the only thing a
worker cannot hand back. So the split is exactly there —
`polygoniseCapsuleFieldBuffers` is everything above it, and the worker calls the
same function the main thread calls. **One implementation, two threads.** Two
implementations of one build is how "faster" quietly becomes "different".

Inputs cross as `Float64Array`, not `Float32Array`. `CapsuleField` narrows to f32
internally, but the active-cell rasteriser reads `caps[i].ax` as a double, and a
rounded read there can move a cell boundary — a different mesh, out of a
"lossless" transport.

Proved rather than argued (`assert-geom-offthread.mjs`): the hero word built down
both paths, hashed over **every byte** of positions, normals, indices and reveal
keys after the Z un-scale — 4,128,064 bytes, `6101cd1d5ceeb19d` on both. Each arm
asserts *which path actually built it* off the module's own counter, because a
worker that silently fell back to the synchronous path would compare itself
against itself and pass forever. And a different wobble must produce a different
hash, which it does — an equality test that cannot fail proves nothing.

## 6. The swap does not go through React, because it cannot

`useStrokeMeshes` is a `useMemo`. Whatever it returns must be returned
synchronously, and **React will not re-render when a worker finishes, because
nothing changed that React can see.** The geometry is not state; it is the memo's
output.

So the swap goes through three.js. The deferred call hands back *the geometry
already on screen* — the same `BufferGeometry` instance — and when the worker
lands, that instance's attributes are replaced in place. three reads the geometry
every frame, so the new surface arrives on the next rendered frame. The mark
never blanks; it holds its last good shape and then changes.

It is also why the whole fix lives in `lib/` and touches no component.

Two details that are not optional. `geometry.dispose()` runs **before** the
attributes are swapped, because `WebGLGeometries` frees GL buffers by walking
`geometry.attributes` *at dispose time* — replace an attribute without it and the
old buffer leaks ~3.5 MB of VRAM per rebuild. (Disposing and continuing to use
the object is safe: `WebGLGeometries.get` re-registers an unknown geometry on the
next render. Read off the three source, not assumed.) And `revealKeys` is patched
onto the live mesh data by hand, because `AnimatedStrokes` binary-searches that
array every frame and its length is the triangle count.

## 7. What is deliberately still synchronous

The reason the whole verification battery is unmoved:

- **Export never defers.** A GLB is always the full synchronous build, which is
  what keeps `geometry-baseline`'s `exportBytes` an honest column rather than one
  that cannot move.
- **The first build of a slot never defers** — nothing on screen to hold.
- **A build never measured expensive never defers.** A slot must have been
  observed at ≥ 120 ms first. Every fixture in the battery builds in tens of
  milliseconds, so none of them leaves the path it was always on.

## 8. The deadlock, and the check that could not see it

Mid-pass the dev server stopped compiling. `✓ Ready in 186ms`, then
`○ Compiling / ...` forever, both routes hanging, **no error printed anywhere**.
`sample` on the process showed every `tokio-runtime-worker` inside
`next-swc.darwin-arm64.node` parked in `_pthread_cond_wait` at 0 % CPU. Not slow —
deadlocked.

Two causes, in order. A stale Turbopack persistent FS cache left by a hard-killed
3½-day-old server; clearing `.next` and restarting gave `GET / 200 in 1162ms`.
And then, on the clean server, a **module cycle through a worker entry**: the
worker imports `implicit-surface.ts`, so putting `new Worker(new URL(…))` in that
same file closes the loop. Bisected in both directions — expression removed,
200 in 1.16 s; expression restored, hang; scheduler moved to its own module,
200 in 424 ms.

Hence the layout, which is load-bearing and not tidiness:

```
implicit-surface.worker.ts  ->  implicit-surface.ts        (no worker reference)
implicit-defer.ts           ->  implicit-surface.ts  +  the worker URL
```

**`tsc --noEmit` stayed green at its 51-error baseline through every minute of a
build that could not compile.** It does not resolve worker URLs and does not walk
a bundle graph. This repo has a standing rule that a green row which cannot fail
is the lie; this is that rule landing on the one check everybody treats as the
floor. *The typecheck passing is not evidence that the app builds.*

## 9. The result

Same probe, same run, both arms:

| | before (`mode: sync`) | after (`mode: worker`) |
|---|---|---|
| nudge at rest, worst frame gap | 859 / 942 / 900 ms | **259 / 250 / 250 ms** |
| nudge while playing | 875 / 858 / 833 ms | **258 / 258 / 258 ms** |
| 8-step drag, total blocked | 5847 ms | **1638 ms** |
| 8-step drag, worst frame gap | 842 ms | **292 ms** |
| Desk Doodles control (no field build) | 217 / 217 / 308 ms | — |

**The acceptance is the last row.** Touching the dial on Free Stroke now costs
259 ms against the control engine's 308 ms — the engine that never had an
implicit build at all. The geometry cost is not reduced, it is *gone from the
thread that paints*; what remains is a cost both engines share.

The drag also shows the cache and the coalescer working: eight steps resolved as
**3 worker builds and 4 cache hits**, instead of eight blocking builds.

## 10. What is left, and where it is

The residual ~200 ms is attributed, not guessed. After the change, the profile of
the same gesture contains **no trace of the field build at all** — `sdSegment`
739 → 0, `eval` 297 → 0, `polygoniseCapsuleField` 93 → 0 — and what is left is:

```
105.6 ms  buildPenField      lib/flat-ink.ts:1460
 61.3 ms  nibHalfWidth       lib/flat-ink.ts
 29.4 ms  penTaperProfile    lib/flat-ink.ts
 17.4 ms  findHeroJunctions  app/desk-doodles/page.tsx
```

`buildPenField` bakes a signed-distance raster over the strokes and is called
synchronously from a `useMemo` in `components/viewport-3d.tsx:2097`. **It is the
same defect, one module over** — a rasterisation on the render thread — and the
same three pieces apply to it unchanged: it is pure arithmetic producing a
`Float32Array`, its output already goes to the GPU through a `DataTexture` whose
image can be replaced between frames, and the texture object is already held in a
ref (`penFieldRef`) that survives re-renders.

Both files belong to another lane, so this is a hand-off rather than a fix, and
the numbers above are what it should be judged against.

## 11. Gates

- `verify-gates.mjs` — **ALL GATES PASS**, 0 console errors; rebuild counts flat
  across 30 style changes in all four modes, export non-empty in all four.
- `geometry-baseline` — **32/32 fixtures byte-identical** (verts, tris,
  exportBytes) against the prior baseline.
- `assert-geom-offthread.mjs` — new; worker and main thread byte-identical over
  4,128,064 bytes, negative control rejects.
- `assert-implicit-reveal` · `assert-elbow` · `assert-fold-census` ·
  `assert-seam` · `assert-cap-fit` · `assert-mode-rims` ·
  `assert-inflate-fusion` — all pass, all with their negative controls.
- `assert-gate-integrity` — **all 64 `assert-*` scripts are gates**, including
  the one added here.
- Typecheck at the **51-error pre-existing baseline** — which, per §8, is not
  evidence the app builds, and is reported as a floor rather than as a pass.

# Explainer 35 — The capture that grabbed the wrong canvas

A lane finishing the reveal-window work recorded this and did not chase it,
correctly, because the file it points at was not that lane's:

> *"On the **third** film take only, frames 113–119 came back **1584×1468 instead
> of 799×1468** — the 3D canvas took full width mid-capture. It did not touch the
> gate or any byte-identity capture (all 799-wide). `apiGrab` takes the **first**
> canvas under `containerRef`, so a second viewport mounting would do this."*

Seven frames out of 360, on one take of three, in a directory nobody diffs. It
was found by **listing a directory**. Nothing failed: no page error, no GL
warning, no exception, no row anywhere went red. The capture loop asked for a
frame, got a frame, and wrote it under the filename it had planned to write.

That profile — silent, rare, self-consistent — is the profile of a defect that
survives for months. This file is what it turned out to be.

---

## 1. First, what it is not

The frames are on disk, so the first move is to look rather than to reason.

```
f108 … f112   799×1468
f113 … f119  1584×1468        <- and the film is 120 frames, f000…f119
film-win-travel   120/120 all 799
film-win-vanish   120/120 all 799
manifest: pageErrors []  ·  glWarnings []
```

**It is the last seven frames of the last take**, not a blip in the middle. And
`f112` against `f113` settles the mechanism at a glance: `f112` is **clipped** —
the horizontal stroke runs off both edges, exactly as explainer 26 §11 records
(*"`frontView(0.8)` frames this fixture edge to edge on the 799 px canvas… both
boundaries are clipped"*) — while `f113` shows **the same mark, unclipped, with
margins**. The scene is continuous across the break; the camera refit because the
aspect changed.

So it is not a second viewport rendering a second scene. It is the *same* canvas
at a different size, and the camera doing its job.

A census of the live page says the rest:

```
canvas #1  799×1508  x=0    div.flex.h-screen… > div.relative.flex-1.border-b >
                            div.relative.h-full.w-full > canvas.h-full.w-full.cursor-crosshair
canvas #2  799×1508  x=801  div.flex.h-screen… > div.flex-1 >
                            div.relative.h-full.w-full > div > div > canvas
```

**Two canvases, and their containers have byte-identical class lists.**
`drawing-canvas.tsx:438` and `viewport-3d.tsx`'s own container are both
`<div className="relative h-full w-full">`. The two halves of the app are
indistinguishable by selector. The only thing that had ever kept the grab on the
right one is which React ref happened to be scoped where.

---

## 2. Two questions, two different fixes

The dispatch that produced this file split it correctly, and the second half is
the one that generalises:

1. **Why does the canvas change size at all?**
2. **Why does the harness take the first one it finds rather than the one it
   means?**

### 2.1 · The harness resolved its subject by POSITION

`components/viewport-3d.tsx`, `apiGrab`:

```ts
const canvas = containerRef.current?.querySelector("canvas") as HTMLCanvasElement | undefined
if (!canvas) return null
return canvas.toDataURL("image/png")
```

`querySelector` returns **the first match in document order**. That is a fact
about layout, not a statement about which canvas was meant. The same line
appeared a second time, on the WebGL-context-loss listener — so a listener that
attached to the wrong element would report *"the viewport lost its context"*
about the other half of the app.

It is reachable today, not merely in principle: in `compare3Up` there are
**three** canvases under that container and the selector silently means *"the
master"*. That happens to be right, and nothing says so. Reorder the grid and the
capture changes subject with no error anywhere.

**The fix is identity.** R3F v9's `<Canvas ref>` forwards to the
`HTMLCanvasElement` itself (`useImperativeHandle(ref, () => canvasRef.current)`),
so the element can be held directly:

```ts
const glCanvasRef = useRef<HTMLCanvasElement | null>(null)
…
<Canvas ref={glCanvasRef} … />          // master only, in 3-up
…
const apiGrab = useCallback(() => glCanvasRef.current?.toDataURL("image/png") ?? null, [])
```

The grab returns the same bytes it did before. What changed is what it **means**.

### 2.2 · The size is not synchronous with the layout — and it is a product fact

R3F does not size its canvas from the DOM at read time. It measures the container
with `react-use-measure` and writes the backing buffer afterwards
(`react-three-fiber.esm.js:42-48`):

```js
const [containerRef, containerRect] = useMeasure({ scroll: true, debounce: { scroll: 50, resize: 0 } })
```

So `canvas.width` is an **async function of layout**, and `toDataURL()` returns
whatever is there right now.

What moves the layout is the more useful half, and this file already knew it.
`viewport-3d.tsx`'s own `stillSize` comment says:

> *"Measured off the live container when the panel opens rather than assumed,
> because **the viewport is a flex child and its size depends on which config
> strip the mode is showing.**"*

Nobody had connected that sentence to the capture. Measured on `/`, 1600×1600
viewport:

```
empty page                        799×1508
after injectStrokes               799×1508
after the Timing popover opens    799×1508      <- not the popover
after setEngine(inflate-implicit) 799×1468      <- the engine's config strip
```

**Switching the geometry mode resizes the raster by 40 px.** Deterministic,
reproducible, and it is already inside the evidence this project rests on. The
byte-identity capture — six engine arms × eight playheads — reports:

```
[schedule] grabs: 48 · sizes {"799x1508":8,"799x1468":40}
```

The eight frames of the **first** engine are a different raster from the other
forty, because `rod` is the default mode and its strip never changes height.
The byte-identity claim itself is unharmed — it compares rod against rod and
inflate against inflate, per (engine, playhead) — but nothing had ever said the
directory was not one raster.

### 2.3 · And the 1584 did not reproduce

360 frames across three deliberate re-shot takes, same fixture, same engine, same
window arms: **799 every frame.** The 40-px height change reproduces on demand;
the 785-px width change did not.

Stated as what it is. *Not reproduced is not the same as not real* — the frames
are on disk. The honest reading is that the width axis needs the left column to
collapse, and nothing in this pass made it collapse. The instrument added below
is what will name it if it happens again, which is worth more than a guess about
which of two async paths won a race that one time.

---

## 3. Can it reach a gate? Yes — and the answer is worse than the question

The lane that recorded it noted the seven frames *"did not touch the gate or any
byte-identity capture."* True, and it is the wrong bar, because nothing was
checking.

**Every raster row on the schedule gate is a comparison of two frames**, and
every comparison helper in it walks the FIRST buffer's length:

```js
function differingPixels(a, b, thresh = 0) {
  let n = 0
  for (let i = 0; i < a.d.length; i += 4) { … }
```

Hand those two frames of different sizes and **nothing throws**. The loop runs to
the shorter one and reads a different pixel at every index past the first row,
because the row stride changed. Concretely:

- a **byte-identity** row would go red for a reason that has nothing to do with
  its subject — and the response to a mysterious red on a negative control is to
  re-record the baseline, which is how a detected violation becomes an invisible
  one;
- a **set-algebra** row — the IoU and excess rows that carry the whole
  window-edge argument — would go **green on garbage**, because a misaligned
  raster still produces a plausible-looking overlap number.

That is the same shape as every other defect this project found in one night: an
instrument answering a question it was not asked, in a format that looks like an
answer.

**So the guard is IN the helpers, not beside them.** `sameShape()` records every
comparison and every mismatch, and `inkMask`, `iou`, `differingPixels`,
`maskOps`, `maskMinus` and `growthComponents` all call it. The gate then carries
a row that can come back red:

```
PASS  not one raster comparison in this run compared two DIFFERENT-SHAPED frames
      — 81 comparisons, 0 mismatches. NOTE the run's grabs are NOT all one size —
      {"799x1508":8,"799x1468":74} — because the viewport is a flex child whose
      height follows the geometry mode's config strip, so switching engines
      resizes the raster. That is legal; comparing across it is not.
```

**81 comparisons, 0 mismatches.** So every green above it in this run was
computed on frames of one shape — which nobody could have said before, and which
is the only reason those greens are worth anything.

The capture also stopped being unable to describe itself. `grabInfo()` reports
the element's backing-buffer size and, critically, **whether position-resolution
still agrees with identity-resolution**:

```
firstUnderContainer true on 82/82 grabs · 1 canvas under the viewport container,
2 in the document
```

A run that ever reads `false` there was, before this change, silently grabbing
something else. And the probe prints its own size census on every film, loudly,
because the seven frames sat on disk for hours with nothing saying so — and
*an admission nothing parses is not an admission.*

---

## 4. The same disease one level up: the tree this lane was handed

Worth recording beside the rest, because it is the identical failure at a
different scale and it was found in passing.

This lane's tree carried **`assert-drawin-attrs.mjs` at 13 653 bytes — the
9-row version** that explainer 24 §6.5 exists to retire, the one that *"could not
fail on half the fix."* The shared checkout has the **19-row** version (34 693
bytes) with `letterCensus`, the drop counter, three known-bad arms and
`--mutate=`. The lane tree had received a **partial** forward-sync: explainer 24
itself was current, the gate that explainer describes was not.

Run as handed, the gate printed **9 rows, ALL PASS**. Every row true. The number
that mattered was the one not on the screen.

Forward-synced and re-run against the same tree: **19 rows, ALL PASS**, all three
known-bad arms rejected. Same subject, same server, twice the questions.

The consequence is a merge hazard rather than a measurement error, and it is the
sharper of the two: **a lane that lands its tree wholesale reverts every file it
never touched but is stale on.** For this lane that list included
`app/page.tsx` (3½ days behind, 5 KB smaller than the shared copy),
`docs/README.md`, three of another lane's style files, and roughly two hundred
verification scripts. The defence is the same one as for the canvas: **name what
you changed by identity**, not "the tree I was working in".

---

## 5. The shape of it

| | what it resolved by |
|---|---|
| `apiGrab` | position — the first canvas in document order |
| the context-loss listener | position — the same selector, a second time |
| the comparison helpers | length — whichever buffer came first |
| the capture's evidence | filename — whatever the loop planned to write |
| the lane's merge | directory — "the tree I was working in" |

Explainer 27 asked whether a gate is pointed at the thing whose name is on it.
Explainer 29 asked how much of a gate ran when the sweep ran it. Explainer 31
asked whether anything in the room could say no. This one is the same question
asked of the **evidence** rather than of the gate:

> **An instrument that resolves its subject by position will eventually resolve a
> different one — and a capture that does it writes the wrong evidence under the
> right name.**

The cheapest defence found here is the one explainer 27 already named and this
pass had to learn again on a different surface: **make the instrument unable to
choose its own subject.** A ref instead of a selector, a shape check inside the
comparison instead of beside it, and a census the capture prints whether or not
anyone asks.

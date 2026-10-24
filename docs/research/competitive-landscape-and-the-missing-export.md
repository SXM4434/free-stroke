# What makes this the best app in its category — the landscape, the one thing, and the export that carries it

*Lane 21, 2026-08-01. Research → build → verify → document. Files written:
`docs/refs-competitive/**`, this doc, `lib/export/**` (new, imported by nothing
yet), and four scripts under `scripts/verify/`. No file owned by another lane
was touched. No commits.*

---

## 0 · How to re-run everything in here

```bash
node scripts/verify/refs-capture.mjs --selftest          # the provenance gate must FAIL on known-bad
node scripts/verify/capture-competitive-refs.mjs --verify # 15/15 refs, sha-checked
node scripts/verify/assert-export-plan.mjs               # 10 rows, each with a control
node scripts/verify/assert-export-encoders.mjs           # 8 rows — ffmpeg decodes what we wrote
node scripts/verify/_run-clean.mjs scripts/verify/assert-export-live.mjs        # 9 rows, real Chrome
node scripts/verify/_run-clean.mjs scripts/verify/assert-export-live.mjs --app  # the real app (needs :3000)
```

---

## 1 · The finding that reframes the question

The brief asks what would make someone pay. **The answer is photographed on a
competitor's pricing page**, and it is not a feature inside the tool.

Jitter — browser motion design, the closest thing to a direct analogue for
"animate a thing in a browser" — prices four tiers, and *every* rung of the
ladder is an export capability
([`ref-15-jitter-pricing.png`](../refs-competitive/ref-15-jitter-pricing.png)):

| tier | what you get, verbatim from the page |
|---|---|
| Free $0 | Video, GIF, Lottie export · **720p, 30fps export** |
| Pro $15 | **1080p, 60fps export** · **ProRes, WebM export** · Image → Video |
| Max $35 *(most popular)* | **Transparent export** · **Frame-by-frame export** · **4K, 120fps export** |
| Ultra $59 | AI credits |

with the footer line *"Upgrade to unlock unlimited files and folders, export in
HD, remove the Jitter watermark."*

Rotato — a one-person-scale indie tool at $7/mo or $59 lifetime — leads its
whole help section with *"Rotato is the only mockup app that can export stills,
videos and web animations"*
([`ref-03`](../refs-competitive/ref-03-rotato-exporting.png)). Spline's export
sidebar is six formats deep — Image, Video, Image Sequences, GLTF/GLB, USDZ,
STL ([`ref-12`](../refs-competitive/ref-12-spline-export.png)).

**Free Stroke exports two things: a still PNG and a GLB that carries none of the
style.** The one system this app is entirely about — animation — cannot leave
the building. That is not a missing feature in the middle of a list. In this
category it is *the* product surface, and it is the whole price ladder.

## 2 · Where Free Stroke actually sits

Three positioning facts came out of LOOKING at the captures rather than reading
the titles:

**The nearest-named neighbour does not do what we do.** Womp's own post *From
Doodles to 3D* turns out to describe importing your sketch **as a reference
image you then model over by hand** — *"letting you use your sketches as visual
references while building… You'll be able to trace outlines, extrude shapes, and
sculpt freely"* ([`ref-04`](../refs-competitive/ref-04-womp-doodles-to-3d.png)).
The gesture is not the input; it is the tracing paper. **Nothing in this capture
set takes a hand gesture in and hands geometry back out.** That is a real, sayable
claim and it is currently said nowhere in the product.

**The incumbent is aimed somewhere else.** Illustrator's 3D & Materials is
*"realistic 3D graphics… with materials sourced from Adobe Substance"*
([`ref-10`](../refs-competitive/ref-10-illustrator-3d.png)). Our four modes do
the same operation aimed at the opposite target — stylised, procedural,
animated, deliberately not photoreal. The divergence is the position.

**The mature model for what we lack is Blender's Grease Pencil.** *"Grease
Pencil is a Blender object. It accepts the drawing information from a mouse or
pressure-sensitive stylus and places it in 3D space as a collection of points,
which are defined as a stroke… Existing strokes can then be adjusted in **Edit
Mode** and **Sculpt Mode**"*
([`ref-09`](../refs-competitive/ref-09-blender-grease-pencil.png)). Two things
there that we do not have: a stroke that stays editable, and pressure as a
first-class input.

## 3 · THE ONE THING — and it is half-buried

> **A mark you drew by hand becomes a real dimensional object, and it builds
> itself back at the speed your hand actually moved.**

Nothing else in the capture set does this. Procreate records the process but the
result stays 2D. Spline and Rotato animate a camera around geometry nobody drew.
Womp needs you to model it. Blender turns a stroke into a 3D object but its
timing comes from a keyframe timeline, not from your hand.

**Is it built?** Yes, and properly. `Point.t` is a real timestamp on every
sample. `revealDistanceFraction(strokes, progress, revealMode, hybridBlend)` maps
export time to *distance along the mark* through the pen's own recorded
hesitations, and it is the same call the 2D register makes
(`components/viewport-3d.tsx:3004-3009`, `lib/flat-ink.ts`). The transport has
`Natural` and `Authentic`, and the panel prints the mark's own measured
character — *"Pen speed departs from constant by up to X% of the stroke
length"*, with a `±X%` chip and a `no timing` state when the strokes carry
nothing usable (`viewport-3d.tsx:7503-7521`). The copy at `:7763` even says it
plainly: *"Authentic replays the speed the pen actually moved."*

**Is it sold? No.** Every sentence above lives *inside a popover, inside the
transport bar, below the viewport*. Meanwhile:

- The document title and description are `Free Stroke` / *"Draw strokes on a 2D
  canvas and convert them to 3D"* (`app/layout.tsx:11-12`). No hand, no timing,
  no animation.
- The empty state says *"Your stroke becomes a 3D form on the right"*
  (`components/drawing-canvas.tsx:419`). True, and it describes a converter.
- The stroke's own timing is otherwise visible only in a
  **`NODE_ENV === "development"` debug read-out** (`drawing-canvas.tsx:426-434`).
- **And it cannot leave.** The one artefact that would carry the claim to
  somebody who has not opened the app is a moving picture, and until this pass
  there was no way to make one.

That is the shape of the gap: *the differentiator is implemented, explained in a
panel, and unshippable.* Procreate's page is the counter-example —
*"Record your artistic process to a Time-lapse video, **and share it with the
world**"*, with recording ON by default and the export a top-level Action
([`ref-01`](../refs-competitive/ref-01-procreate-timelapse.png)).

## 4 · What is missing, ranked by what a buyer notices first

Ranked by *how early in a first session it is felt*, not by effort.

| # | gap | how soon it bites | evidence |
|---|---|---|---|
| **1** | **No animated export.** | The first time they want to show anyone. | PRD §12 v4. Now buildable — §5. |
| **2** | **The pitch does not say the thing.** Title, description and empty state all describe a converter; the differentiator is a panel tooltip. | Second 1. Before a single stroke. | `app/layout.tsx:11-12`, `drawing-canvas.tsx:419`. |
| **3** | **No mobile layout at all.** The whole app surface contains **exactly one responsive utility** — `sm:grid-cols-3` in the style panel. `app/globals.css` has **no `@media` rule except `prefers-reduced-motion`**. The layout is `flex h-screen flex-col` → `flex flex-1` with two hard `flex-1` children (`app/page.tsx:599, 1152-1165`), so a 390 px phone gets two ~195 px columns. `use-mobile` exists **twice** (`hooks/use-mobile.ts`, `components/ui/use-mobile.tsx`) and the only importer is the vendored, unused `components/ui/sidebar.tsx`. | Instantly, for anyone on a phone — and a drawing app is the single most likely thing to be opened on a touch device. | measured 2026-08-01, grep counts above. |
| **4** | **Stroke editing does not exist.** Undo-last and Clear-all (`drawing-canvas.tsx:335-341`). You cannot move, reshape, retime or delete one stroke of several. | The second time they draw something *nearly* right. | vs Grease Pencil's Edit Mode + Sculpt Mode, [`ref-09`](../refs-competitive/ref-09-blender-grease-pencil.png). |
| **5** | **The GLB carries none of the four style layers.** The app's own source says why: *"Everything the style stack does — texture, dither, ASCII, the fusions, the layer stack — is a SHADER, so none of it survives a glTF export"* (`viewport-3d.tsx:202-205`). Material preset and custom material are the only style inputs in `buildGLBBuffer`'s deps. | The first time they open their download in anything. | PRD §12 v2/v3. |
| **6** | **Dark mode is dead code.** `.dark` tokens are defined (`app/globals.css:42`), `components/theme-provider.tsx` exists, and **`app/layout.tsx` mounts nothing** — `<html lang="en">` with no theme class, no `next-themes` provider anywhere in `app/`. | Whenever they notice the app ignores their system. | measured 2026-08-01. |
| **7** | **Pressure is recorded and read by nothing.** The panel admits it: *"Speed only: pen pressure is recorded but no engine reads it yet"* (`viewport-3d.tsx:7786`). | Stylus users, immediately. | `Point.pressure` exists in `lib/stroke-processing.ts:23`. |
| **8** | **Geometry animation lacks stroke order, tip highlight, settle/wobble.** Speed, delay, ease, reverse, loop and the Natural/Authentic pair are all built. | Once the novelty of the reveal wears off. | PRD Layer 3, Phase 22. |
| **9** | **The pipeline is not numbered.** Monster Mash — a research demo — puts `1 Draw · 2 Inflate · 3 Animate` in its toolbar ([`ref-11`](../refs-competitive/ref-11-monster-mash.png)). Ours is draw → mode → style → animate → export and the chrome numbers none of it. Our empty state is *better* than theirs; our sense of sequence is worse. | Minute 2, when they have a mark and do not know the order of operations. | capture. |
| **10** | **Nothing to arrive at.** No sample mark, no gallery, no "here is one someone made". A creative tool whose first screen is empty is asking for a cold start. | Second 5. | — |

**What nobody had listed, in one line each:** the pitch (#2) is the cheapest,
highest-leverage item on this board and costs a copy pass; a scroll-driven
embeddable is a third export target that Rotato sells and nobody in *our* space
offers; and GIF still autoplays where video does not, which is why
`mattdesl/gifenc` has 1.5K dependents despite being labelled
`stability: experimental` and untouched for two years
([`ref-13`](../refs-competitive/ref-13-gifenc.png)).

## 5 · What was built — `lib/export/`, and why it is shaped like this

**The smallest honest slice that makes the differentiator shippable: a
frame-locked animated exporter, complete, in two formats, with the drawing's own
duration as its clock.**

```
lib/export/frame-plan.ts   the timebase — WHICH instants the film contains
lib/export/webm.ts         a ~250-line EBML/Matroska muxer for WebCodecs output
lib/export/apng.ts         an animated-PNG writer: lossless, with alpha
lib/export/encoders.ts     the two encoders behind one interface + codec probing
lib/export/recorder.ts     the loop: seek → grab → encode, awaited, never on a clock
lib/export/index.ts        exportAnimation()
```

Nothing in it imports React, three, or any app module, and **nothing in the app
imports it** — §6 is the wiring diff for the lane that owns the components.

### 5.1 The one decision that makes it ours

Every competitor's frame-locked exporter picks a duration. **Ours defaults to
the duration you drew in.** `timebase: "pen"` makes the film's draw phase exactly
`totalDuration`, the strokes' own first-to-last timestamp span — so a 4.237 s
gesture is a 4.237 s film, and the panel string says so out loud: *"4.27s at 30
fps — **the time this took you to draw**"*. `timebase: "fixed"` is the canned
alternative and is one option away. That single word in the label is the
difference between an export and the product's argument.

This is also *why* frame-locking is not an implementation detail here. A screen
recorder samples wall-clock time, so a frame that took 90 ms to render occupies
90 ms of the file — which does not add jitter to our subject, it **overwrites**
it. Spline states the same argument as a user benefit: *"Instead of relying on
recording the screen, it renders defined animations for maximum precision,
ensuring consistent transition timing and smooth playback"*
([`ref-12`](../refs-competitive/ref-12-spline-export.png)). The canonical
implementation of the technique, `spite/ccapture.js`, was **rewritten onto
WebCodecs five days before this capture**
([`ref-08`](../refs-competitive/ref-08-ccapture.png)) — the ecosystem is
converging on exactly this right now.

### 5.2 Build vs depend, decided by looking

The obvious dependency, `Vanilagy/webm-muxer`, carries commits titled
**"Deprecate webm-muxer"** and points its homepage at its successor
([`ref-14`](../refs-competitive/ref-14-webm-writer.png)). That successor,
**Mediabunny**, is genuinely better and lists **transparent WebM** among its
formats ([`ref-05`](../refs-competitive/ref-05-mediabunny.png)) — which would
collapse our two output formats into one. It is also a new dependency in a
`package.json` three other lanes are live against, for one container with one
video track and no audio. So: 250 lines of our own now, **gated by decoding its
output with a real ffmpeg**, and Mediabunny recommended as the upgrade in §8.

### 5.3 Two formats, for two different questions

WebM/VP9 is the thing you post. **APNG is the thing you composite** — lossless
(a dithered or ASCII mark is exactly the high-frequency graphic a video codec
smears), alpha-carrying, and needs no `VideoEncoder`, so it is also the fallback
where WebCodecs is absent. That pairing is not "more formats": *transparent
export is the headline feature of Jitter's $35 tier and of Rotato's export page*,
and our still export already ships a transparency checkbox — an animated export
that could not match it would be a step backwards from the still.

### 5.4 Evidence

**`assert-export-plan.mjs` — 10 PASS · 0 FAIL**, every row with a mutation
control that must fail:

```
PASS  pen timebase: output duration IS the recorded drawing duration — draw 4237.0ms vs pen 4237ms · 128 frames
PASS  every frame time is index/fps to floating-point exactness — worst deviation 9.09e-13ms
PASS  the mark is SEEN finished: the last frame's clock is exactly 1 — frame #30 @ 1000.00ms
PASS  2x speed halves the DRAW only; lead-in and hold keep their real length
PASS  a completion pulse has frames to happen in — 25 frames at clock=1 with an 800ms hold, 1 without
PASS  reverse starts complete and ends empty
PASS  an absurdly long drawing is capped AND says so — 18001 requested → 3600 kept
PASS  the pen timebase SAYS what it is; the fixed one does not pretend to
PASS  a zero-length drawing still yields one usable frame
PASS  EXPORT_PAPER still equals the app's STILL_PAPER — #fafafa / #fafafa
```

**`assert-export-encoders.mjs` — 8 PASS · 0 FAIL.** The judge is `ffmpeg-static`,
already a devDependency, asked to **decode** what we wrote:

```
PASS  APNG: ffmpeg decodes our file, all frames present — 12/12
PASS  APNG is LOSSLESS and keeps alpha: decoded RGBA === the bytes we wrote — 147456 bytes
PASS  APNG delay is a real ms rational — 33ms → 0.360s · 100ms → 1.100s
PASS  every APNG frame differs from the one before it
PASS  the VP9 keyframe reader finds the real keyframes — 1 in 60
PASS  WebM: ffmpeg decodes OUR container, all frames present — 60/60 · clean
PASS  WebM: our muxing decodes BIT-IDENTICALLY to ffmpeg's own muxing of the same VP9 frames — 3456000 bytes
PASS  WebM carries OUR timestamps — declared 2.000s (want 2.000) · last frame 1.960s (want 1.967)
```

The bit-identical row is the one that makes the muxer trustworthy: one VP9
encode → an IVF → ffmpeg remuxes it one way, we mux it the other, both decode to
the same 3,456,000 bytes.

**`assert-export-live.mjs` — 9 PASS · 0 FAIL**, in system Chrome, headless,
`--use-angle=metal`, importing the **actual `lib/export/*.ts` sources**
transpiled on the way into the page (never a copy, so the gate cannot drift):

```
PASS  no page errors during the export — 0 errors
PASS  WebCodecs VideoEncoder exists in this browser
PASS  the WebM path was actually taken, not the APNG fallback
PASS  the exported WebM decodes, with exactly the frames the plan asked for — 137/137 · declared 4.570s
PASS  the file's declared duration is the plan's duration
PASS  PEN TIMEBASE: the film's draw phase is the drawing's own recorded duration — 4237.0ms vs 4237.0ms
PASS  the reveal is IN the file: ink grows from first frame to last — 122 distinct frame means of 137
PASS  the transparent export is an APNG that decodes, with alpha — 21/21 frames
PASS  the APNG really is transparent where the mark is not — 95.9% of pixels at alpha 0
```

Artefacts: [`../verification/export-v1/`](../verification/export-v1/) — the
`.webm`, the `.png`, a static-arm control, and two contact sheets.

### 5.5 Three defects this pass found in its own work

1. **A NaN timebase from a one-line default.**
   `isFinite(x ?? 1) && (x ?? 1) > 0 ? (x as number) : 1` tests the *defaulted*
   value and returns the *undefaulted* one. Omitting `speed` produced
   `undefined`, every duration downstream was NaN, and the plan had **0 frames**.
   Caught by the first run of `assert-export-plan.mjs`.
2. **The closing frame did not exist.** `1000 / (1000/30)` is
   `29.999999999999996`, so a 1-second draw at 30 fps floored to 29 frames and
   **stopped at 966.67 ms with the mark 3 % unfinished** — invisible in a still,
   and the single most common defect in exported loops. Fixed with an epsilon
   that is ~200× the double-precision noise at the largest ratio the plan can
   produce.
3. **🔴 The one the numbers could not see.** The first exported WebM decoded
   cleanly, had the right frame count, the right duration, and 121 distinct
   frames — every row green. **The contact sheet showed a nearly black
   rectangle.** A video codec has no alpha channel, so a transparent canvas
   composites onto black, and a dark ink stroke on black is nothing. The
   recorder now composites an explicit ground for any opaque format
   (`EXPORT_PAPER`, gated against the app's own `STILL_PAPER` by
   `assert-export-plan.mjs` so the copied constant cannot rot). **This is the
   entry for the "correct code that rendered wrong" list in `docs/README.md` —
   it makes six.**

## 6 · The wiring diff (components are another lane's — this is the spec)

The module is deliberately host-agnostic, and **the app can wire it with no
change to the still-export path at all**, because `STILL_EXPORT.grab` already
returns a `Blob` and `FrameSource` accepts blobs.

**6a · Minimum viable wiring — `components/viewport-3d.tsx`, ~30 lines.**
Beside `handleExportPNG`, add:

```ts
import { exportAnimation } from "@/lib/export"

const handleExportVideo = useCallback(async (opts: { fps: number; scale: number; transparent: boolean }) => {
  const grab = STILL_EXPORT.grab
  if (!grab) return
  const res = await exportAnimation({
    penDurationMs: totalDuration,
    timebase: "pen",
    fps: opts.fps, scale: opts.scale, transparent: opts.transparent,
    holdMs: 600, markName: exportName,
    hasAnimatedStyleLayer: styleAnimating,           // any time-varying layer on
    host: {
      seek: (p) => { setPlaying(false); clockRef.current = unEaseReveal(p, revealEaseRef.current); playheadRef.current = p; setProgress(p) },
      easePlayhead: (c) => easeReveal(c, revealEaseRef.current),
      settle: () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      grabFrame: async (o) => { const s = await grab(o); return s && { kind: "blob", blob: s.blob, width: s.width, height: s.height } },
    },
    onProgress: (d, t) => setExportProgress(d / t),
  })
  // same download + toast path as handleExportPNG; surface res.warnings
}, [totalDuration, exportName, /* … */])
```

Then one button in the export popover beside PNG/GLB, plus fps (24/30/60) and a
Transparent checkbox that already exists for the still.

**6b · The one thing the module cannot fix from outside — the style clock.**
The reveal is already deterministic (`playheadRef` + `__revealHarness`). The
**style** clock is not: `advanceStyleClock(clock, delta, playheadRef.current,
totalDuration)` is called from the R3F frame loop with the real frame delta
(`viewport-3d.tsx:2095`), so texture drift, dither crawl, glyph scroll and the
completion pulse run on wall time. Export at 30 fps while a frame takes 120 ms
and those layers advance four times too far per frame. The module reports this
rather than hiding it (`RecordResult.warnings`), but the fix is host-side:

```ts
// near STYLE_CLOCK_DEBUG
export const STYLE_CLOCK_DRIVE: { exactMs: number | null } = { exactMs: null }

// in the frame loop, replacing the bare `advanceStyleClock(clock, delta, …)`
const drive = STYLE_CLOCK_DRIVE.exactMs
if (drive === null) advanceStyleClock(clock, delta, playheadRef.current, totalDuration)
else {
  const d = Math.max(0, drive / 1000 - clock.elapsed)
  advanceStyleClock(clock, d, playheadRef.current, totalDuration)
}
```

and then `setSceneTimeMs: (ms) => { STYLE_CLOCK_DRIVE.exactMs = ms }` on the host,
reset to `null` in a `finally`. **Acceptance:** export the same mark twice with
an animated texture on, at two different artificial render delays, and require
the two files to decode to identical pixels — with an arm that leaves the clock
wall-driven as the negative control, which must differ.

**6c · One optional speed-up, not required.** `STILL_EXPORT.grab` PNG-encodes
every frame. Adding `format?: "png" | "canvas"` to `StillOptions` and returning
the composited `HTMLCanvasElement` when asked skips a PNG encode + decode per
frame; `FrameSource` already accepts `{ kind: "canvas" }`.

## 7 · Specced, not built — each with its evidence and its acceptance

- **GIF.** The only format that autoplays in every paste target. Needs a colour
  quantiser (median-cut or Wu) and dithering *of the dither*, which is a taste
  decision on a product whose subject is already dithered. `mattdesl/gifenc` is
  the best implementation and is `stability: experimental`, 1.5K dependents,
  untouched for two years ([`ref-13`](../refs-competitive/ref-13-gifenc.png)).
  Acceptance: decoded GIF frames within a bounded ΔE of the WebM's, with a
  256-colour control that must fail on a full-frame ASCII field.
- **A scroll-driven embeddable.** Rotato sells this as its third export
  ([`ref-03`](../refs-competitive/ref-03-rotato-exporting.png)) and nobody in
  the drawing-to-3D space offers it. Shape: the same `FramePlan`, emitted as a
  frame sequence plus a ~2 KB player that maps scroll position to frame index —
  i.e. our existing scrubber, exported. Acceptance: the embed's frame at scroll
  fraction *f* is byte-identical to the video's frame at *f*.
- **Transparent *video*.** One dependency away (Mediabunny's transparent WebM),
  or a `BlockAdditions` alpha channel in our own muxer. Today the honest answer
  is the one shipped: transparent means APNG, and the module refuses to write an
  opaque file labelled transparent.
- **Animated GLB.** PRD §12 v5. The reveal is a `setDrawRange` over an
  arc-length ordering, which glTF has no representation for; the nearest honest
  export is a morph-target or per-frame node-visibility animation, and it is a
  research task, not a wiring task.
- **Stroke editing.** The largest missing product surface (§4 #4). Blender's
  answer is two modes — per-point Edit and brush-based Sculpt
  ([`ref-09`](../refs-competitive/ref-09-blender-grease-pencil.png)). The
  cheapest first slice for us is *select one stroke → delete / re-time / nudge*,
  because `Stroke.points` already carries everything needed and `processStroke`
  is already per-stroke.

## 8 · Open calls — Sebs's, not mine

**① The default timebase.** *Recommend `pen`.* It is the product's argument made
visible in one label, and it is the only setting in the export that no
competitor can copy without recording the hand. **What the other branch costs:**
a fixed 3 s default gives predictable, social-ready clip lengths and never
produces a 40-second file from a slow drawing — at the price of throwing away
the exact thing that makes the export ours. The truncation ceiling (3600 frames)
already covers the pathological case, and the fixed option stays one click away.

**② Depend on Mediabunny, or keep our own muxer.** *Recommend keeping ours for
now and revisiting when transparent video is wanted.* Ours is 250 lines, has no
supply chain, and is gated by an ffmpeg decode. **What the other branch costs:**
Mediabunny buys transparent WebM (collapsing our two formats into one), MP4
output, and someone else's maintenance — at the price of a dependency added to a
`package.json` three lanes are live against, and MPL-2.0 to read before shipping.

**③ Does the pitch change?** The title, description and empty state currently
describe a converter (§3). *Recommend saying the differentiator in all three.*
**What the other branch costs:** "converter" is the plainer promise and sets a
lower bar the app definitely clears; the hand-and-timing promise is the one worth
paying for and the one we would then have to keep. This is copy, and copy is a
voice call — it is flagged, not written.

**④ Where the export button lives.** Procreate makes it a top-level Action
([`ref-01`](../refs-competitive/ref-01-procreate-timelapse.png)); ours would
default into the existing export popover beside PNG and GLB. *Recommend the
popover for now* — but note that the popover is also where the differentiator is
currently buried, and the pattern is worth breaking exactly once.

## 9 · What is NOT done

- **The `--app` arm of `assert-export-live.mjs` has not run green.** The shared
  Next dev server on `:3000` (pid 5573, `next-server v16.1.6`, another lane's)
  did not answer a request in 90 s across four attempts, and `next dev` refuses a
  second instance — *"Unable to acquire lock at `.next/dev/lock`"*. The code
  path is written and drives the app's real dev hooks
  (`__revealHarness.setProgress` + `__captureHarness.grab`) on a stroke drawn
  with real pointer events; it has not been executed. **The module is proven in
  a real browser; the module *against this app* is not.**
- **The wiring in §6 is a spec, not a diff on disk.** `components/**` is another
  lane's.
- **The style clock is still wall-driven** (§6b) — the module warns, and the
  warning has never been seen by a user because nothing calls the module yet.
- **No GIF, no scroll-embed, no transparent video, no animated GLB** (§7).
- **Nothing in §4 rows 2–10 was fixed** — every one of them lives in a file this
  lane does not own. They are an audit with evidence, not a to-do I quietly did.
- The audio path of the muxer does not exist and is not needed.
- `ref-07` (MDN `VideoEncoder`) was captured and provenance-verified but **no
  mechanism is claimed from it**; the API facts came from a first-hand probe
  instead, which is stated where they are used.

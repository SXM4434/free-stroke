# 21 — The five ways this app could lose your work

Research: `docs/research/undo-redo-conventions.md`.
Gate: `scripts/verify/assert-data-safety.mjs` — **134 rows, controls included; 133 green, 1 red and blocked** (§9).

The bar for this pass was one sentence: *nobody pays for a tool that loses their
work.* Five defects were found against it. All five had shipped, and none of
them announced itself — every one is silent by construction, which is why they
survived a product that has 67 assertion gates.

| | The defect | What it cost |
|---|---|---|
| 1 | Clear destroyed the drawing on disk instantly | everything, on one mis-click, from a button beside Undo |
| 2 | Undo was one stroke deep; redo did not exist | 13 of 15 preset families were unreachable by ⌘Z — and they are the destructive 13 |
| 3 | The mark survived a reload wearing nothing | every dial, every layer, the whole styling — which the PRD says *is* the product |
| 4 | Neither storage key carried a version in its payload | a shape change silently orphans your data, or restores foreign data as current |
| 5 | The stroke filter validated the container, not the points | one point without a timestamp breaks the reveal, invisibly |

---

## 1. Undo was not a stack, and the missing families were the wrong ones

⌘Z worked. It popped the last stroke and it did that correctly.

⇧⌘Z did nothing, anywhere in the product, and the reason was one line —
`components/drawing-canvas.tsx:350`:

```js
if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
```

The handler bailed on `e.shiftKey` before doing anything, so the redo binding
was swallowed by the undo binding. There was no redo to reach.

Presets had their own undo, and it was a `useRef` holding **one** snapshot,
reachable **only** by clicking an action inside a toast before that toast
dismissed. No keyboard binding. And it covered the **geometry** and **view**
families — two of fifteen.

**The thirteen with no undo are the destructive thirteen.** That is not bad
luck, it is mechanical: `applyPresetToStyleState` *resets every composition rail*
before merging a preset's patch, which is correct — otherwise each preset
inherits whatever the last one left behind — and it means clicking "Terminal
Stack" throws away the texture, dither, ASCII, stack and fusion you had
composed. The families that wipe your work were exactly the families you could
not take back.

Dial drags and layer-stack edits captured nothing at all. Deleting a custom
fusion — the one thing in this app a user can *author* that is not the drawing —
was immediate, unconfirmed, and persisted on the next tick.

### What replaced it

`lib/undo-stack.ts`, a past/future stack over whole-document snapshots.

Snapshot rather than command, and the reason is the mutation sites. The style
panel drives every control in the product through **one** `setStyleState` prop.
A command model needs a do/undo pair per control; a snapshot model needs one
interception point. And snapshots are nearly free here because every field is
already immutable everywhere — `{ ...s, field }`, `[...prev, next]` — so a
snapshot copies ten references. A hundred snapshots of a two-hundred-stroke
drawing share all two hundred strokes.

The interception is in `app/page.tsx`:

```
setStyleStateRecorded → diff prev vs next → derive a LABEL and a COALESCE KEY
                                          → commit → applyPatch
```

**The label and the coalescing key are derived from the diff**, not registered
per control. That is what makes every panel control undoable without editing
`components/style-panel-scaffold.tsx` — including controls that do not exist
yet. Proved on a real panel slider through the DOM:

```
PASS  3.12  a 12-sample drag on a STYLE PANEL slider is ONE step — 1 step(s): [Texture scale]
PASS  3.12  …named from the diff, with no per-control registration — label = "Texture scale"
PASS  3.11  the Undo button NAMES it 'Delete fusion' — derived from the diff, not registered by hand
```

`Delete fusion` is derived by comparing list **lengths** — shorter means delete,
longer means add, same means edit — because "Fusion library" would have been the
field name and not what happened.

---

## 2. Coalescing: the research changed the design

This was going to be a time window. ProseMirror's `newGroupDelay` is 500 ms,
Yjs's `captureTimeout` is 500 ms, Quill's `delay` is 1000 ms — three primary
sources, read in the source files, all agreeing on the shape.

**They are all text editors, and that is the catch.** Typing has no gesture
boundary, so a clock is the only thing available. Every *graphics* tool in the
reference set uses the boundary instead:

- tldraw: *"Changes accumulate until you create a mark… Create marks at the start of user interactions."*
- Excalidraw: `CaptureUpdateAction.IMMEDIATELY`, documented as excepting *"ephemerals such as dragging or resizing."*
- Cocoa: `NSUndoManager.groupsByEvent`, **default true** — one run-loop pass, one group.

The consequence is concrete: **a pure 500 ms window splits a slow drag.** A dial
in this app exists so you can drag it slowly and watch the render change —
pausing to look is the intended use, and it crosses 500 ms every time.

So the stack implements all three mechanisms, and each covers what the others
cannot:

| | Mechanism | Covers |
|---|---|---|
| identity | `key`, Qt's `QUndoCommand::id()` rule (`-1` = never merge) | two different dials never merge; discrete actions never merge |
| gesture | `beginGesture`/`endGesture` on pointerdown/pointerup | a drag of any duration is one step |
| window | `COALESCE_MS = 500` | arrow-key nudges and colour pickers, which have no gesture |

The bracket listens at the **window, in the capture phase**, for
`input[type=range]` and `input[type=color]`. One listener covers every slider in
the product including the ones in a file this lane does not own.

```
PASS  2.5   a SLOW drag — 10 samples, 900ms apart, all outside the window — is still ONE step — 1 entry
PASS  CONTROL · 2.5   the SAME slow samples with NO gesture bracket split into 10 steps
PASS  3.6b  a SLOW real drag (4 samples, 700ms apart) is still ONE step — 1 step(s): [Spacing]
PASS  3.6b  …and the pointer bracket was genuinely open throughout — gestureOpen during drag = [true, true, true, true]
```

### The bug the assertion found in the fix

The first bracket was a boolean — "is a gesture open". Then §3.6b dragged the
same slider **twice in a row**, with a real pointerup between, and the second
drag added **zero** steps: the top entry still carried that slider's key, a
bracket was open again, so the second gesture merged into the first one's entry.
Two deliberate gestures, one undo step, ⌘Z jumping back further than asked.

A gesture needs an **identity**, not a flag. Each bracket now takes a serial
number and an entry remembers which gesture produced it; merging requires the
*same* gesture. A pointerup is a boundary because the next pointerdown is a
different number — which is what a gesture boundary means.

---

## 3. Clear: undoable, so it needs no dialog — plus the part a stack cannot do

Clear was `setRawStrokes([])`, and the persist effect wrote `"[]"` through to
`localStorage` on the next tick. No confirm, no snapshot, no undo, on a button
flush against Undo.

The HIG position on this is unambiguous and has one origin — Raskin's *Never Use
a Warning When you Mean Undo*: *"after clicking 'Okay' countless times… we'll
probably click 'Okay' this time too, even if we don't mean to."* NN/g says the
same in the negative: confirm only for *"serious consequences"*, and otherwise
*"do go to great lengths to provide undo."* A prompt taxes every correct use of
the button to defend against the rare wrong one, and users learn to dismiss it,
which is worse than not having it.

So Clear is a step on the stack and ⌘Z takes it back. The toast stays as
discoverability; it is no longer the mechanism.

**But a stack is in memory, and the history does not survive a reload** (§5
below says why that is the right call). So *clear, then close the tab* is the one
path an undo stack cannot cover — and it is the exact path that loses
everything. Clear therefore writes the removed strokes to their own key first,
and the next boot offers them back:

```
PASS  3.3   …and the cleared drawing is written to the TRASH key before the canvas key is emptied — trash holds 3 stroke(s)
PASS  3.3   the trash slot survives independently of the undo stack
PASS  3.3   ⌘Z brings the whole drawing back after Clear — 0 -> 75 pts
```

### The toast was sitting on the Undo button

Found by `document.elementFromPoint` returning sonner's `<li>` where a range
input should have been. At the default offset, a `bottom-center` toast lands on
top of the canvas's own action bar at `bottom-3`.

It is the worst possible overlap in this particular app: **Clear raises a toast
whose description says "⌘Z brings them back", and that toast was covering the
Undo button.** The message telling you what happened was on the control that
takes it back. Fixed with `offset={88}`, and asserted rather than eyeballed:

```
PASS  3.3   with the Clear toast on screen, the Undo button is still hittable
              — topmost element over Undo = button.fs-press rounded-lg …
```

---

## 4. The styling evaporated on reload

Strokes persisted. Nothing else did. Every dial, the layer stack, the active
preset, the custom material, the geometry mode and all its params were `useState`
and went with the tab.

The PRD is not ambiguous about what that costs — §1: *"Draw something by hand,
turn it into an animated 3D ink/sculptural object, style it with procedural
visual layers like dither and ASCII, animate those layers."* Sixteen layers, of
which exactly one is the stroke. The app was persisting layer 1.

`freestroke.session.v1` now carries the other fifteen:

```
PASS  3.8   every style dial survives a reload — 13/13 fields intact
PASS  3.8   the geometry mode and its params survive too — mode=inflate blend=0.42 res=2.5
PASS  CONTROL · 3.8   the restored state is genuinely NOT the default state — material=chrome dither=true cell=17
```

That control matters: without it, "13/13 intact" would also pass on a state that
never moved.

### What deliberately does NOT persist

- **Processed strokes** — derived. Storing them stores a cache that can disagree
  with its source. (Pre-existing decision, kept.)
- **The camera** — view state, not document state. GIMP states the line most
  clearly: undo excludes *"actions that affect the image display without altering
  the underlying image data. The most important example is zooming."* Blender
  contradicts this (its Global Undo covers *"changing panel settings"*), and the
  test that reconciles them is **"is it in the saved file?"** — GIMP's zoom is
  not in the XCF; Blender's modifier value is in the .blend. Our camera is not in
  the GLB. So it is neither persisted nor undoable.
- **Which panel was open** — `app/page.tsx` states the intent in code: *"closed
  by default so the app opens canvas-first — the gesture is the product."*
  Persisting a drawer open overwrites an authored first impression on every
  reload, to save one click.
- **The undo history** — it is a stack of documents. Persisting it multiplies
  storage by the depth cap and creates the largest migration surface in the app:
  a schema change would have to migrate not one document but a hundred. A reload
  is a session boundary, and Procreate says the same out loud — undos are
  *"forgotten"* on returning to the Gallery. The hole this leaves is closed by
  the trash slot, not by persisting the stack.

`materialUserOverride` **is** persisted despite being a flag rather than a value,
because without it a restored session silently re-applies the per-mode default
material the first time you touch the mode pills, throwing away a pinned
material. A flag that guards user intent is user intent.

---

## 5. The version was in the key name

`freestroke.strokes.v1` and `freestroke.fusions.v1` carried a version only in
the KEY. The payload was a bare JSON array. Two failure modes:

1. **Bump the key** and every existing user's work is orphaned in place — still
   on disk, never read again, nothing said.
2. **Forget to bump it** — the default, because nothing enforced it — and a
   payload of a different shape is restored as if it were current.

The second one is not hypothetical here. `lib/style-fusion.ts:786` documents
where it lands: a link out of an older or hand-edited blob resolves
`src[link.source]` to `undefined`, `undefined * a` is `NaN`, the `v === 0` guard
does not stop it because `NaN === 0` is false, and `f.ditherScaleMul *= NaN`
poisons a **multiplicative accumulator** — so one bad link voids every other link
you authored against that parameter, and the result lands in a shader uniform,
where a NaN is not a wrong picture but an undefined one.

`lib/storage.ts` puts the version in the payload. The shape is lifted from
`dialkit`, already a dependency of this repo (`dist/index.js:464`):

```js
if (parsed?.version !== 1 || typeof parsed !== "object") return null;
```

…with the three things dialkit does not need and we do: a migration path, a
**kind** tag, and a quarantine.

| Outcome | What it is | What happens |
|---|---|---|
| `ok` | current version | used |
| `migrated` | older, or a **bare pre-envelope array** | migrated up, then validated |
| `corrupt` | unparseable, or no registered migration | quarantined |
| `foreign` | valid envelope, wrong `kind` | quarantined |
| `future` | `v` higher than this build | quarantined **and moved** |
| `invalid` | failed its own validator | quarantined |

**v0 is the load-bearing migration**, not a courtesy: a bare array is what is on
disk on every machine that has ever opened this app.

**`future` is moved, not left in place**, and that is the subtle one. Refusing to
read a newer payload is not enough on its own, because the app autosaves the key
on the very next state change — a refusal that left the blob there would have the
next save stomp the work it had just declined to read.

```
PASS  1.3   a newer build's work SURVIVES the autosave that immediately overwrites the key
```

**Quarantine, never delete.** Every rejection moves the bytes to
`<key>.quarantine` with the reason, a timestamp, and a **count** — Chromium's
`json_pref_store.cc` does the same (`BackupPrefsFile()` renames to `.bad`:
*"Since the file is corrupt, move it to the side and continue with empty
preferences"*), and the count distinguishes one bad blob (bad luck) from a
repeat (the *writer* is broken, and the next save will corrupt the replacement
too).

---

## 6. Validate the points, not the container

The old filter:

```js
(s) => !!s && typeof s === "object" && Array.isArray(s.points) && s.points.length > 1
```

It never looked inside `points`. That is not a small gap, because of one line in
`lib/stroke-processing.ts:497`:

```ts
t: prev.t + (curr.t - prev.t) * ratio
```

`resampleStroke` **interpolates** the timestamp. So one point with a missing `t`
does not break one point — the damage is written into every resampled point
downstream of it, and `penTimeDistanceFraction` (`lib/pen-reveal.ts:97`) then
fails its own finiteness guard and returns `null`. The draw-in reveal, the
product's signature moment, silently stops being time-driven.

The repair policy is split on purpose:

- **x / y non-finite → drop the point.** There is no truth to recover; a
  fabricated coordinate is a shape the user never drew. Under two points, drop
  the stroke.
- **`t` non-finite → re-derive it.** Timing is capture metadata; the alternative
  is dropping the stroke, which discards the *shape*, which is what was actually
  authored. This is the **opposite** call from `lib/style-fusion.ts:786`'s about
  a malformed fusion link, and deliberately so: a link encodes a relationship the
  user authored and substituting a source would invent one; a timestamp encodes
  how fast their hand moved, which is already gone.
- **`t` out of order → clamp, then check the span.**

Every repair is counted and surfaced. A silent repair is indistinguishable from a
bug.

### Two things the assertion caught that reading could not

**Clamping alone re-introduced the defect.** A stroke whose timestamps run fully
backwards (`90, 40, 10`) clamps to a **constant** (`90, 90, 90`) — every point
non-decreasing, every point identical — which passes a monotonic check and then
fails one line later, because `penTimeDistanceFraction` requires `t1 - t0 > 0`.
The repair had recreated the exact bug it existed to prevent. It now checks the
span and re-derives from index order when there is none.

**"Broken" is not "non-finite".** `JSON.stringify` turns `NaN` and `Infinity`
into `null`, and `null` **coerces to 0** in that interpolation — so those
payloads never produce a NaN at all. They produce a run of points all carrying
`t = 0`: finite, ordered, and completely wrong, because the reveal paints that
whole span of the mark in **zero time**. A finiteness check called it healthy.
The control now measures the largest fraction of arc length covered by a run of
identical timestamps — and a corrupt `x`/`y` needed a *third* channel again,
because `null → 0` silently places the point at the origin, growing a phantom
segment leading in from the corner with nothing non-finite anywhere.

---

## 6b. A full disk was the quietest loss of all

`localStorage` is ~5 MB per origin and the drawing is the big thing in it —
measured on this build, 40 strokes × 120 points is **274 KB**, so roughly 700
such strokes fill it. At the ceiling the write simply throws, and both the old
code and `writeVersioned`'s own `catch` swallowed it. You keep drawing, every
autosave fails, nothing changes on screen, and the reload takes back everything
after the ceiling.

It now says so, once (the effect fires per stroke; a toast per stroke would be
its own defect).

### And the availability probe was making it worse

`storage()` proved localStorage worked by writing a probe key. **On a full disk
that probe is the thing that throws** — so `storage()` returned null and the
write reported `unavailable` instead of `quota`. Those mean different things to a
user: *"this browser will not persist anything"* versus *"your drawing has
outgrown the budget, export it."* The app was about to give the wrong one at the
exact moment it mattered. Availability is now decided by a **read**, which costs
no quota; whether a write will fit is answered where the write happens.

```
PASS  1.5b  a write that hits the quota returns `quota`, it does not return ok — outcome=quota
PASS  3.14  when the browser's storage is full, the app SAYS the drawing will not survive a reload
              — filled 4.99 MB in 23 keys; toasts = "This drawing is too large to save automatically…"
```

Writing costs nothing at normal sizes, measured in the page: **0.003 ms** for a
session write (which fires per pointer sample during a dial drag) and **0.070 ms**
per stroke write, against a 16.67 ms frame budget.

---

## 7. Every row has a control that must come back red

This repo has caught eleven instruments reporting green while measuring nothing,
so the gate runs three kinds of control on the **default** invocation, never
behind a flag:

- **The prior predicate.** The OLD container-only filter runs verbatim beside the
  new validator on the same payloads. An arm is evidence only when the old filter
  **accepted** it — 9 of 9 did.
- **The unprotected subject.** The malformed fusions are pushed through the
  multiplicative accumulator with the guard bypassed and the poison is
  **required** to reproduce (2 of the 4 shapes that can reach it go non-finite).
- **The inverted gesture.** Every "this is ONE step" is paired with a sequence
  built to be many, which must report many.

The gate itself is checked by the meta-gate:

```
assert-data-safety.mjs      yes      yes      LIVE      gate
ALL 67 assert-* SCRIPTS ARE GATES.
```

`LIVE` matters. §3 clicks real buttons, drags real sliders with real pointer
events, and presses real keys at the window. It reads the stack back through the
dev harness only to **count**, never to perform the action being asserted — this
project has shipped a bug where harness assertions passed while the feature was
unreachable by a human.

Several of the first-run failures were the instrument, not the subject, and each
is written into the file as a warning rather than quietly fixed:

- `addInitScript` runs on **every** navigation — so it wiped the styling the test
  had just saved, then asserted it was lost.
- The Presets panel left open in §3.4 covered the slider §3.6 was aiming at
  (`elementFromPoint` said `li`, which is how the toast overlap in §3 was found).
- Playwright's `selectOption` leaves focus on `body`, so a row claiming "with
  focus still on the dropdown" was measuring a keypress delivered to the body
  until it was made to set focus **and verify it**.
- §3.14 filled storage in 512 KB blocks until one threw, leaving ~0.5 MB free —
  and a 25-point stroke fits in that easily, so the write succeeded and the row
  failed while the app behaved correctly. The instrument had not created the
  condition it was asserting about.

And one row was born unable to fail: §2.6 read `canRedo`, did nothing, and read
it again. It is kept in the file with that history in a comment, because it is
the exact shape of the eleven green-but-blind rows this repo has caught.

---

## 8. The work is restored and the screen is still empty

Everything in §4 proves the *document* comes back. Then the screenshot answered
the only question a user actually asks after a reload — **is my work there?** —
and the answer was no. The 2-D canvas shows the strokes, every style chip reads
correctly, and the 3-D viewport, which is the product, is **blank** until you
find Play.

Measured across the reload: reveal progress **1 → 0**; viewport PNG **70,723 →
11,656 bytes** (16.5 %); adding one stroke takes it to **72,866** (6.25×).

**Root cause, `components/viewport-3d.tsx:6087`:**

```ts
const prevStrokeCountRef = useRef(processedStrokes.length)
```

The effect under it plays the reveal when the count **goes up**. The 3-D chunk is
dynamically imported, so it mounts *after* the restore effect has already put the
strokes in state — the ref initialises to the restored count, the effect's first
run finds `prevCount === newCount`, neither branch fires, and the playhead stays
at 0.

**The fix is one token:** `useRef(-1)`. With 0 strokes the `newCount === 0`
clause still wins and the playhead stays at 0; with strokes already present the
first run takes the "new stroke added — show fully" branch. Both halves of that
mechanism are measured — a fresh page that receives strokes *does* go to progress
1 — but **the patched file has not been run**, because `viewport-3d.tsx` belongs
to another lane and two live lanes may not hold one file.

It is **not** worked around from this lane on purpose. The alternative available
here is to withhold the restore until the 3-D chunk has mounted, which couples
the drawing's recovery to a dynamic import — so a chunk that failed to load would
lose the drawing entirely. That is a worse bug than the one it fixes.

It is gated as §3.8b, red, with the diff in the failure message, so it turns
green the moment the change lands and stays gated afterwards. Its control shows
the reader can tell the two states apart by **9.39×**, so the red is the subject,
not the instrument.

---

## 9. Gates

| Gate | Result |
|---|---|
| `assert-data-safety.mjs` (new) | **133/134**, controls included, under `_run-clean`. The one red is §9 |
| `assert-gate-integrity.mjs` | ALL 67 assert-* scripts are gates; the new one is `emits · exit-coupled · LIVE` |
| `verify-gates.mjs` | ALL GATES PASS — including geometry-rebuild at 2→2 / 4→4 / 5→5 / 6→6 over 30 style changes |
| `geometry-baseline --save=lane25` | **32/32 cases byte-identical** to `l23` and `lane18-after` |
| `assert-geometry-presets` / `assert-view-presets` / `assert-style-contracts` / `assert-preset-registry` | 14 / 12 / 44 / 58, all pass |
| `assert-preset-routing` | 32 pass, **1 fail** — see below |
| `tsc --noEmit` | **51**, the known baseline, none in this lane's files |

### The other red row, and why it is correct

`assert-preset-routing.mjs:492`:

```js
say(
  (await page.evaluate(() => window.__styleHarness.revertPreset())) === false,
  "CONTROL · undo is one-shot — a second call reports that it did nothing",
)
```

That control encodes the **one-slot** design this pass deliberately removed.
`revertPreset` is now an alias for the real undo, so a second call steps back
further and returns `true`. Measured:

```
r1=true  r2=true  depthAfter2=0  r3=false
```

Making the harness alias one-shot while ⌘Z used the stack would put the
instrument and the product in disagreement, which is the divergence this repo
keeps getting bitten by. The file belongs to another lane; the replacement
assertion is specified in the return rather than applied here.

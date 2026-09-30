# Undo and redo: what the conventions actually are

*The evidence behind `lib/undo-stack.ts`. That file makes five decisions —
snapshot over command, a 500 ms coalescing window, a 100-step cap, linear redo,
and a list of things ⌘Z deliberately cannot reach. This document is where those
five numbers and rules come from, who else landed on them, and the two places
where the sources do **not** agree and we had to choose.*

---

## How to read the citations in this document

Every quote below was pulled by fetching the URL in this session. The fetcher
returns a page or source file and extracts the passage asked for. **Where a
passage is in quote marks, I read it in the returned document.** Where I am
working from a search-result summary rather than the page itself, it is labelled
**secondary — unverified** and you should not treat the number as measured.

Numbers carry one of three tags:

- **quoted** — I read this value in the primary source named.
- **derived** — computed here from something quoted.
- **open** — I could not establish it. Said plainly, not smoothed over.

Four sources I wanted were unreachable from this environment. They are listed in
§0.2 with what they would have settled, so the gaps are visible rather than
papered over.

---

## 0. Sources

### 0.1 Reached

| URL | What it is | Reachable | The load-bearing thing it told us |
|---|---|---|---|
| [prosemirror-history `src/history.ts`](https://raw.githubusercontent.com/ProseMirror/prosemirror-history/master/src/history.ts) | The undo plugin for ProseMirror — the editor core under the NYT, Atlassian, Substack | yes | `newGroupDelay` **defaults to 500 ms**, `depth` **defaults to 100**, and a new step needs *either* the delay *or* non-adjacency |
| [Quill History module docs](https://quilljs.com/docs/modules/history) | Public docs for Quill's history module | yes | `delay: 1000`, `maxStack: 100`, `userOnly: false` — "Changes occuring within the `delay` number of milliseconds are merged into a single change." |
| [Quill `modules/history.ts`](https://raw.githubusercontent.com/slab/quill/main/packages/quill/src/modules/history.ts) | The implementation of the above | yes | Confirms the defaults in code, and that merging is a **compose** of deltas into the popped top entry |
| [Yjs `UndoManager.js`](https://raw.githubusercontent.com/yjs/yjs/main/src/utils/UndoManager.js) | The undo manager for the most widely deployed CRDT library on the web | yes | `captureTimeout = 500`; merge requires the window **and** `!undoing && !redoing`; `trackedOrigins = new Set([null])` — i.e. *local* changes only, by default |
| [Yjs UndoManager docs](https://docs.yjs.dev/api/undo-manager) | The prose docs for the above | yes | "defaults to 500ms"; "The changes can be optionally scoped to transaction origins." |
| [slate-history `with-history.ts`](https://raw.githubusercontent.com/ianstormtaylor/slate/main/packages/slate-history/src/with-history.ts) | Slate's history plugin | yes | `set_selection` is **never saved to history**; merging is structural (adjacent text ops), not time-based; cap of **100** |
| [Excalidraw `history.ts`](https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/history.ts) | Excalidraw's undo/redo | yes | "don't reset redo stack on local appState changes, as a simple click (unselect) could lead to losing all the redo entries" |
| [Excalidraw `element/src/store.ts`](https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/element/src/store.ts) | Where Excalidraw decides what reaches history | yes | Three-valued `CaptureUpdateAction` — IMMEDIATELY / EVENTUALLY / NEVER — with "except ephemerals such as dragging or resizing" written into the doc comment |
| [Excalidraw PR #7348](https://api.github.com/repos/excalidraw/excalidraw/pulls/7348) | "feat: multiplayer undo / redo" — the history rewrite, read as API JSON | yes | Deltas not snapshots; an explicit **durable vs ephemeral** split; undo *skips* entries with no visible impact |
| [Figma — How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) | Figma's engineering post | yes | "undo in a multiplayer environment is inherently confusing"; the invariant is that undo-then-redo-back-to-present must not change the document |
| [Figma Plugin API — `figma.commitUndo`](https://developers.figma.com/docs/plugins/api/properties/figma-commitundo/) | Plugin API reference | yes | "By default, plugin actions are not committed to undo history." A whole plugin run is *one* step unless it opts to split |
| [tldraw — History (undo/redo)](https://tldraw.dev/sdk-features/history) | tldraw SDK docs | yes | Marks are stopping points; "Changes accumulate until you create a mark"; three modes — `record` / `record-preserveRedoStack` / `ignore` |
| [tldraw `HistoryManager.ts`](https://raw.githubusercontent.com/tldraw/tldraw/main/packages/editor/src/lib/editor/managers/HistoryManager/HistoryManager.ts) | The implementation | yes | `modeToState` maps those three modes to recorder states; `bail()` = undo **without** pushing to redo |
| [tldraw `store/src/lib/migrate.ts`](https://raw.githubusercontent.com/tldraw/tldraw/main/packages/store/src/lib/migrate.ts) | Store migration machinery | yes | A named failure reason `TargetVersionTooNew: 'target-version-too-new'` — forward incompatibility is a *first-class outcome*, not a crash |
| [tldraw `store/src/lib/StoreSchema.ts`](https://raw.githubusercontent.com/tldraw/tldraw/main/packages/store/src/lib/StoreSchema.ts) | Snapshot envelope | yes | `serialize()` writes `{ schemaVersion: 2, sequences: {...} }` beside the data; `schema.schemaVersion > 2 → Result.err('Bad schema version')` |
| [Qt — Overview of the Undo Framework](https://doc.qt.io/qt-6/qundo.html) | The canonical desktop-toolkit statement of the command pattern | yes | "all editing in an application is done by creating instances of command objects"; names **command compression** and **command macros** as the two grouping tools |
| [Qt — QUndoStack](https://doc.qt.io/qt-6/qundostack.html) | Class reference | yes | "If commands were undone before cmd was pushed, the current command and all commands above it are deleted" — linear redo, stated as a rule |
| [Qt — QUndoCommand](https://doc.qt.io/qt-6/qundocommand.html) | Class reference | yes | "A command ID … must be an integer unique to this command's class, or -1 if the command doesn't support compression"; merge is attempted **only** between same-ID commands |
| [Apple HIG — Undo and redo](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/undo-and-redo.json) | Apple's Human Interface Guidelines (fetched as the docs JSON; the HTML page returns an empty shell) | yes | "Avoid placing unnecessary limits on the number of times people can undo"; the batching bullet about "incremental adjustments to a single property"; **Command–Z / Shift–Command–Z** |
| [Apple — `NSUndoManager.groupsByEvent`](https://developer.apple.com/tutorials/data/documentation/foundation/undomanager/groupsbyevent.json) | Foundation API reference | yes | "A Boolean value that indicates whether the manager automatically creates undo groups around each pass of the run loop." **Default is true.** |
| [NN/g — Confirmation dialogs](https://www.nngroup.com/articles/confirmation-dialog/) | Nielsen Norman Group | yes | Confirm only for "serious consequences"; "do go to great lengths to provide undo" |
| [NN/g — User control and freedom](https://www.nngroup.com/articles/user-control-and-freedom/) | The heuristic itself | yes | "clearly marked 'emergency exit' … Support undo and redo." |
| [A List Apart — Never Use a Warning When you Mean Undo (Raskin)](https://alistapart.com/article/neveruseawarning/) | The essay the whole "undo not confirm" position traces to | yes | "after clicking 'Okay' countless times … we'll probably click 'Okay' this time too, even if we don't mean to" |
| [GIMP — Undoing](https://docs.gimp.org/2.10/en/gimp-concepts-undo.html) | GIMP user manual | yes | The clearest statement anywhere of the document-vs-view line, and the **minimum-count + memory-ceiling** dual bound |
| [Blender manual — `system.rst`](https://projects.blender.org/blender/blender-manual/raw/branch/main/manual/editors/preferences/system.rst) | The Blender manual source (docs.blender.org itself 403s) | yes | "Undo Steps: Number of Undo steps available." / "Undo Memory Limit: Maximum memory usage in Mb (0 is unlimited)." / Global Undo covers "changing panel settings or switching between modes" |
| [Procreate — How to Undo and Redo](https://help.procreate.com/articles/tvicQm-undo-and-redo) | Official Procreate help | yes | "In each active session, up to **250** of your most recent steps can be undone"; undos are "forgotten" on returning to the Gallery |
| [Krita — General settings](https://docs.krita.org/en/reference_manual/preferences/general_settings.html) | Krita manual | yes | Undo Stack Size: "the number of undo commands Krita remembers. You can set the value to 0 for unlimited" |
| [MDN — Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) | The web platform's own versioned store | yes | `VER_ERR` "indicates that the version of the database stored on the disk is *greater* than the version that you are trying to open" — the platform **refuses**, it does not coerce |
| [Chromium `components/prefs/json_pref_store.cc`](https://raw.githubusercontent.com/chromium/chromium/main/components/prefs/json_pref_store.cc) | Chrome's own preferences reader | yes | `BackupPrefsFile()` renames to a `.bad` extension: "Since the file is corrupt, move it to the side and continue with empty preferences" |
| [Vim — `undo.txt`](https://vimhelp.org/undo.txt.html) | Vim's undo documentation | yes | The tree alternative, stated precisely: "This happens when you undo a few changes and then make a new change. The undone changes become a branch." |
| [Contentsquare Engineering — Rewriting History](https://engineering.contentsquare.com/2023/history-undo-redo/) | An engineering post on adding undo to a complex web app | yes | Describes "a hybrid of Memento and Command patterns". Thin on the questions we care about — see §1.4 |

### 0.2 Not reached — and what that costs

| URL | What it would have settled | What happened |
|---|---|---|
| `helpx.adobe.com/photoshop/using/undo-history.html` and `.../performance-preferences.html` | Photoshop's **default history-state count**, its maximum, and the documented list of changes that are *not* history states | Four fetch attempts across two URLs and two path prefixes, all **connection timeouts**. `helpx.adobe.com` did not respond to this environment at all. The widely repeated "default 50, maximum 1000" is **secondary — unverified**; I did not read it on an Adobe page |
| `docs.blender.org/manual/en/latest/editors/preferences/system.html` | Blender's **default Undo Steps** value and range | **HTTP 403** on every attempt. Recovered the *descriptions* from the manual's `.rst` source on projects.blender.org, but the `.rst` does not state defaults |
| `developer.blender.org/docs/features/core/undo/` and `devtalk.blender.org` | Blender's memfile-vs-local undo split and its undo-push categories | **HTTP 403** on both. The commonly cited "32 default, 256 max" is **secondary — unverified** |
| `help.figma.com` undo article | Figma's own documented statement of what is and is not undoable | I could not locate an official Figma help article on undo. Site-scoped searches returned only third-party tutorials. Figma's *engineering blog* and *plugin API* are cited instead; the help centre is **open** |
| `web.archive.org` | A route around the two blocks above | The fetch tool refuses this host outright |
| `m2.material.io` / `m3.material.io` | Material's position on snackbar-with-undo vs confirm | Both return a JS shell with no body text to the fetcher. Material's position is **open** here; the NN/g and Raskin sources carry §4 instead |
| `nngroup.com/articles/undo/` | A dedicated NN/g piece on undo granularity | **404** — no such article exists. NN/g's position is taken from the two articles that do |
| Automerge undo/redo docs | CRDT undo semantics from the primary source | Only a search summary was obtained. Yjs carries §1.5 instead; Automerge specifics are **open** |

---

## 1. The canonical architectures

### 1.1 Command

Qt's overview is the cleanest statement of it, and it is worth having verbatim
because everything else in this section is defined against it:

> The Command pattern is based on the idea that all editing in an application is
> done by creating instances of command objects. Command objects apply changes to
> the document and are stored on a command stack.

Each command knows how to do and undo itself. Memory cost is the size of the
*difference*, not the document. The price is discipline: **every mutation site
has to construct a command**, and one site that forgets is a silent hole in the
history.

Qt also supplies the two grouping primitives the rest of this document keeps
running into:

> **Command Compression** — Used to compress sequences of commands into a single
> command. For example: In a text editor, the commands that insert individual
> characters into the document can be compressed into a single command that
> inserts whole sections of text.

> **Command Macros** — A sequence of commands, all of which are undone or redone
> in one step.

Compression is *implicit* merging of like with like. A macro is an *explicit*
bracket around unlike things. §2 is entirely about the first; the transaction in
`undo-stack.ts` is the second.

### 1.2 Memento / snapshot

Store the state, not the operation. Restoring is assignment, which means it
cannot be wrong — there is no inverse operation to get backwards. The textbook
objection is memory, and the textbook objection assumes the document is copied.

In an immutable-data codebase it is not copied. A "snapshot" of a document whose
fields are all persistent references is a new wrapper object pointing at the same
children. **Derived:** for Free Stroke, whose strokes live in arrays that are
only ever replaced with `[...prev, next]`, 100 snapshots of a 200-stroke drawing
hold 100 small wrappers and **one** copy of each stroke. The stroke data is
shared, not duplicated. This is the argument `lib/undo-stack.ts:28-33` makes, and
it is sound — but note it is an argument that only holds *while* every mutation
site stays immutable. A single in-place `arr.push()` anywhere in the style rails
would silently corrupt every snapshot above it. That is the real maintenance
burden of the snapshot model, and it is a different burden from the command
model's (which is "you forgot a command"), not a smaller one in general — only a
smaller one *here*, because this repo already mutates immutably everywhere.

### 1.3 Delta

Excalidraw's rewrite is the best-documented delta implementation in a drawing
app. From PR #7348 ("feat: multiplayer undo / redo"): a delta is a pure object
holding `deleted` (the previous values) and `inserted` (the new ones), so
**inverting a delta is swapping two fields** — no inverse-operation code per
action type. The store keeps an "always up-to-date snapshot" and *computes*
deltas against it.

That is the important structural insight and it dissolves the usual
snapshot-vs-delta framing: Excalidraw keeps a snapshot **and** stores deltas. The
snapshot is the reference frame; the deltas are what goes on the stack.

Cost comparison, stated honestly:

| model | stack memory | code you must write | can it be wrong |
|---|---|---|---|
| command | delta-sized | one do/undo pair **per action type** | yes — a wrong inverse |
| snapshot (immutable) | one wrapper per step | **one** interception point | no, if immutability holds |
| snapshot (mutable/deep-copied) | full document per step | one interception point | no, but it will cost |
| delta | delta-sized | one differ + one applier, generic | no, if the differ is right |

The delta model wins on paper. It wins by less when the document is small and
structurally shared, and it costs a differ you then have to keep correct across
sixteen style rails.

### 1.4 What the one engineering write-up actually said

The Contentsquare post is the only third-party engineering account I reached. It
describes "a hybrid of Memento and Command patterns", keeping two arrays — one
of actions to redo, one of "opposite actions" to undo — and grouping by an
`actionId` funnelled through an async stream. **It does not discuss memory cost,
does not discuss which action types are excluded from history, and does not
discuss coalescing beyond that `actionId` bundling.** I am recording it because
it exists and it is real, not because it settled anything. Treat it as
third-choice evidence.

### 1.5 CRDT undo — the one thing worth stealing

Yjs's `UndoManager` is the reference implementation. Two details matter even
though Free Stroke is single-player:

**Undo is scoped by origin, not by time.** The default is
`trackedOrigins = new Set([null])` — the null origin is a local, un-tagged
transaction. Anything the network or a programmatic import applies under a
different origin is invisible to undo. This is the same idea as ProseMirror's
`"addToHistory": false` meta and Excalidraw's `CaptureUpdateAction.NEVER`: **the
system needs a way to change the document without that change becoming a step.**
Every mature implementation has one. A codebase that lacks one ends up with
"undo restored my autosaved state" bugs.

**Undo is a new change, not a rewind.** Figma's post makes the multiplayer
consequence explicit:

> Undo history has a natural definition for single-player mode, but undo in a
> multiplayer environment is inherently confusing.

and states the invariant they hold:

> if you undo a lot, copy something, and redo back to the present (a common
> operation), the document should not change.

> in Figma an undo operation modifies redo history at the time of the undo, and
> likewise a redo operation modifies undo history at the time of the redo.

Excalidraw's version of the same problem produces a behaviour worth knowing
about even single-player: their history "iterates history stack on undo/redo,
when the recorded changes have no visible impact" — if a step would change
nothing, it is skipped and the next one is taken. **A ⌘Z that visibly does
nothing is worse than no ⌘Z**, because the user presses it again.

---

## 2. Coalescing — the question that decides whether ⌘Z is usable

This is the section that matters most for us. The failure it prevents: a dial
drag fires a change per pointer sample, so a two-second drag is ~40 stack
entries, and ⌘Z walks the dial back one sample at a time instead of returning it
to where the gesture began.

There are **three** mechanisms in the wild, and the tools do not all use the
same one. This is the first place the sources genuinely disagree.

### 2.1 Mechanism A — the time window

The dominant mechanism in text editing.

**ProseMirror.** From `src/history.ts`, the option's own doc comment:

> The delay between changes after which a new group should be started. Defaults
> to 500 (milliseconds).

**Quoted: 500 ms.** But the condition is not time alone:

```js
let newGroup = history.prevTime == 0 ||
  (!appended && history.prevComposition != composition &&
   (history.prevTime < (tr.time || 0) - options.newGroupDelay ||
    !isAdjacentTo(tr, history.prevRanges!)))
```

Read that carefully, because it is the most instructive line in this document. A
new group is started when the delay has elapsed **OR** when the change is not
*adjacent* to the previous one. Adjacency is checked as
`start <= prevRanges[i + 1] && end >= prevRanges[i]`. So: type continuously for
ten seconds and it is still one group; type one character, click somewhere else,
type another character, and it is **two** groups even though they were 80 ms
apart. Time alone never decides.

**Quill.** From the docs page and confirmed in `modules/history.ts`:

```ts
static DEFAULTS: HistoryOptions = {
  delay: 1000,
  maxStack: 100,
  userOnly: false,
};
```

> Changes occuring within the `delay` number of milliseconds are merged into a
> single change.

**Quoted: 1000 ms** — twice ProseMirror's. The merge is a delta compose onto the
popped top entry:
`if (this.lastRecorded + this.options.delay > timestamp && this.stack.undo.length > 0)`
then `undoDelta = undoDelta.compose(item.delta)`.

**Yjs.** `captureTimeout = 500`, and the merge condition adds two guards beyond
time:

```js
if (this.lastChange > 0 && now - this.lastChange < this.captureTimeout &&
    stack.length > 0 && !undoing && !redoing) {
```

**Quoted: 500 ms.** The `!undoing && !redoing` guard is the one people forget:
changes *produced by* an undo must never merge into the entry below them.

So the time-window camp: **500 / 1000 / 500**. Two of three sit at 500 ms.

### 2.2 Mechanism B — the gesture / run-loop boundary

Time windows are a text-editing answer. Graphics tools mostly do not use them,
because a pointer gesture has an unambiguous start and end and there is no reason
to guess.

**tldraw.** From the SDK docs:

> Changes accumulate until you create a mark, then the pending changes are
> flushed to the undo stack as a single entry.

and the instruction to authors:

> Create marks at the start of user interactions so that complex operations can
> be undone in one step.

There is no delay constant. The step boundary *is* the interaction boundary.
`Editor.squashToMark` exists to collapse a multi-step operation after the fact:
"combines all changes since a mark into a single undo step. Intermediate marks
are removed."

**Excalidraw.** The rule is written into the type that every state update carries
(`packages/element/src/store.ts`), and the doc comment names the exact case:

```ts
/**
 * Immediately undoable.
 *
 * Use for updates which should be captured.
 * Should be used for most of the local updates, except ephemerals such as dragging or resizing.
 *
 * These updates will _immediately_ make it to the local undo / redo stacks.
 */
IMMEDIATELY: "IMMEDIATELY",
```

with `EVENTUALLY` for "updates which should not be captured immediately — likely
exceptions which are part of some async multi-step process", and `NEVER` for
remote updates and scene initialisation.

So a drag in Excalidraw is `EVENTUALLY` while it moves and the whole gesture
lands as one entry when something next captures `IMMEDIATELY`. **Caveat on
sourcing:** I asked the fetcher to find the pointer handlers in `App.tsx` that
apply this; the file is ~10k lines and it reported that it could not search it
exhaustively, offering only the general pattern. **The `CaptureUpdateAction`
definition above is quoted; the claim about exactly where in the pointer handlers
each value is used is not verified and should be treated as open.**

**Apple / Cocoa.** `NSUndoManager.groupsByEvent`:

> A Boolean value that indicates whether the manager automatically creates undo
> groups around each pass of the run loop. … The default is true.

This is mechanism B at the framework level, and it is the default on macOS: **one
turn of the event loop is one undo step, automatically.** It is worth registering
that the platform Free Stroke visually belongs to has been doing gesture-boundary
grouping — not time-window grouping — since 1994.

**Figma (plugins).**

> By default, plugin actions are not committed to undo history.

An entire plugin run is one step; `figma.commitUndo()` is how a plugin *opts in*
to splitting it. Same shape: the boundary is the operation, not the clock.

### 2.3 Mechanism C — identity ("same target")

Orthogonal to both, and present in every implementation that handles sliders
properly.

**Qt** is the crispest:

> A command ID is used in command compression. It must be an integer unique to
> this command's class, or -1 if the command doesn't support compression.

> QUndoStack::push() will only try to merge two commands if they have the same
> ID, and the ID is not -1.

Two facts fall out of that single rule, and they are exactly the two questions
asked of this research:

1. **What forces a new step mid-drag?** Touching a *different* control. Different
   command class → different ID → merge is not even attempted. No timing
   involved.
2. **What can never merge?** Anything whose `id()` is −1. That is the escape
   hatch for discrete commands — delete, clear, apply-preset — which must be
   their own step even if two of them arrive 30 ms apart.

**Slate** implements identity structurally rather than numerically — `shouldMerge`
returns true only for consecutive `insert_text` where
`op.offset === prev.offset + prev.text.length && Path.equals(op.path, prev.path)`.
Same path, contiguous offset. **Slate has no time window at all.** Identity and
adjacency carry the whole thing.

### 2.4 Where the sources disagree, stated plainly

| | time window | gesture boundary | identity |
|---|---|---|---|
| ProseMirror | 500 ms | — | adjacency of ranges |
| Quill | 1000 ms | — | — |
| Yjs | 500 ms | — | transaction origin |
| Slate | **none** | — | op type + path + offset |
| tldraw | **none** | marks | — |
| Excalidraw | **none** | ephemeral/durable | — |
| Cocoa | — | run-loop pass | — |
| Qt | — | macros | command ID |

**There is no consensus that a time window is the right mechanism.** It is the
text-editing answer, and it exists there because typing has no gesture boundary —
there is no "keydown that starts the word". A pointer drag *does* have a
boundary, and every graphics tool in this table uses it instead.

The practical consequence is a defect a pure time window has and a gesture
boundary does not: **a slow drag splits.** Drag a dial, pause 600 ms while
looking at the result, keep dragging — with a 500 ms window that is two undo
steps for one gesture, and ⌘Z leaves the dial halfway. Nobody's mental model has
a stopwatch in it. (This is the one substantive change §8 recommends to
`undo-stack.ts`, which currently uses mechanism A + C but not B.)

### 2.5 What the guidelines say about the same question

Apple's HIG states the user-facing requirement without prescribing a mechanism,
and it is unusually precise about the slider case:

> **Consider giving people the option to revert multiple changes at once.** In
> some scenarios, people might appreciate the ability to undo a batch of discrete
> but related actions — like incremental adjustments to a single property or
> attribute — so they don't have to undo each individual adjustment.

"Incremental adjustments to a single property or attribute" is a dial drag,
described in guideline language. Note it also independently justifies mechanism C
— the batch is defined by *the property*, not by the clock.

---

## 3. What ⌘Z is expected to reach: document state vs view state

### 3.1 The clearest statement of the line

GIMP's manual, which is the most explicit any of these documents get:

> Actions that do not alter the image generally cannot be undone. Examples
> include saving the image to a file, duplicating the image, copying part of the
> image to the clipboard, etc. It also includes most actions that affect the
> image display without altering the underlying image data. **The most important
> example is zooming.**

"Affect the display without altering the underlying data" is the line, named. And
it is named with the exact example we needed: **zoom — i.e. camera — is not
undoable.**

### 3.2 Selection

Two independent sources, both explicit, both agreeing.

**Slate** simply never records it:

```ts
const shouldSave = (op: Operation, prev: Operation | undefined): boolean => {
  if (op.type === 'set_selection') {
    return false
  }
  return true
}
```

**Excalidraw** goes further and protects the *redo* stack from it, in a comment
that reads like a bug report:

> don't reset redo stack on local appState changes, as a simple click (unselect)
> could lead to losing all the redo entries only reset on non empty elements
> changes!

That is a second, sharper rule and it is easy to miss: it is not enough that a
selection change fails to *push* an undo step. It must also fail to *clear the
redo stack*. Otherwise the user undoes three times, clicks the canvas to look at
something, and their redos are gone — destroyed by a click that changed nothing.

### 3.3 The counter-example: Blender puts view-adjacent state *in*

Blender does not draw the line where GIMP does, and pretending otherwise would be
smoothing. From the manual source, on Global Undo:

> This enables Blender to save actions done when you are **not** in *Edit Mode*.
> For example, duplicating objects, **changing panel settings or switching
> between modes**.

Panel settings and mode switches are on Blender's undo stack. That is a real
disagreement with GIMP's "affects display only → not undoable", and it is not an
accident: in Blender a "panel setting" is frequently a modifier parameter, i.e.
document state wearing a panel's clothes, and mode is a property of the object.

**The transferable rule is not "panels are never undoable". It is: the line runs
between *what is in the saved file* and *what is not*.** GIMP's zoom is not in
the XCF. Blender's modifier panel value is in the .blend. Apply that test and
both tools are consistent with each other, and the test is mechanical enough to
settle every case in §8.

### 3.4 Tool switch, and "history ends at a session boundary"

I did not find a documented statement that a **tool switch** is or is not
undoable in any primary source. **Open.** The saved-file test in §3.3 answers it —
the active tool is not in anyone's saved file — but I am flagging that as
derived, not quoted.

On session boundaries, Procreate is documented and unambiguous:

> In each active session, up to 250 of your most recent steps can be undone.

> Undos are sequential, and will be "forgotten" when you return to the Gallery or
> exit Procreate.

**Undo history dying when you leave the document is normal, documented,
shipped behaviour in the most successful drawing app on tablets.** It is not a
compromise.

### 3.5 The escape hatch every implementation has

Collected, because §8 needs one and it is worth seeing that this is universal:

| tool | how you change the document without making a step |
|---|---|
| ProseMirror | "You can set an `"addToHistory"` metadata property of `false` on a transaction to prevent it from being rolled back by undo." |
| Yjs | origin not in `trackedOrigins` |
| Excalidraw | `CaptureUpdateAction.NEVER` |
| tldraw | `editor.run(fn, { history: 'ignore' })` |
| Figma plugins | the default — nothing is committed unless `commitUndo()` is called |

---

## 4. Destructive actions: confirm, or undo?

### 4.1 The argued position

Raskin's essay is the origin of the modern position and the argument is about
habituation, not about dialogs being ugly:

> after clicking "Okay" countless times in response to the question, we'll
> probably click "Okay" this time too, even if we don't mean to

> If an interface is to be humane, it must respect habituation.

The conclusion is the title: never use a warning when you mean undo. A
confirmation you always click through provides zero protection *and* costs
everyone a click.

### 4.2 The carve-out, from the same camp

NN/g does not fully agree, and the disagreement is the useful part:

> Use a confirmation dialog before committing to actions with serious
> consequences — such as destroying users' work or costing large amounts of
> money.

> Do not use confirmation dialogs for routine actions. Like in Aesop's fable, if
> you cry wolf too many times, people will stop paying attention.

> do go to great lengths to provide undo, because some user errors will remain
> despite the even the best of confirmation dialogs.

Read together with Raskin, the resolved rule is not "never confirm". It is:

**Confirm only when the action is (a) destructive to work and (b) genuinely not
undoable. If you can make it undoable, that is the fix — and the confirm then
becomes the thing NN/g warns about.**

And Nielsen's own heuristic, quoted from the source article:

> Users often choose system functions by mistake and will need a clearly marked
> "emergency exit" to leave the unwanted state without having to go through an
> extended dialogue. Support undo and redo.

### 4.3 The trap this sets for us

There is a corollary nobody states outright and it bites Free Stroke directly.
"Make it undoable instead of confirming" is only honest **if the undo actually
survives long enough to be used.** An undo stack that dies on reload (§3.4, and
`lib/doc-store.ts` says ours deliberately does) means:

- Clear canvas → undoable → fine, *until the user reloads*.
- Delete a fusion the user authored → undoable in session → but the fusion is
  persisted work that outlives the session, so a session-scoped undo is a weaker
  guarantee than the object deserves.

So the rule needs a third clause: **undo instead of confirm, provided the undo's
lifetime is at least as long as the thing it protects.** Where it is not, you owe
either a confirm or a durable recovery slot. `lib/doc-store.ts` already reaches
for the second (a trash slot); this document is the argument for why that was the
right call rather than a nicety.

---

## 5. Redo semantics

### 5.1 A new action destroys redo — near-universal, and stated as a rule

Qt says it flatly:

> If commands were undone before cmd was pushed, the current command and all
> commands above it are deleted.

tldraw encodes it as the default of a three-valued option, which is the most
informative version of the answer because it shows the alternative was
considered:

| mode | undo stack | redo stack |
|---|---|---|
| `record` | Add | **Clear** |
| `record-preserveRedoStack` | Add | Keep |
| `ignore` | Skip | Keep |

`record` is the default. `record-preserveRedoStack` exists for changes that are
real edits but shouldn't invalidate the user's redo path — which is the same
concern as Excalidraw's "don't reset redo stack on local appState changes"
(§3.2), reached by a different route. **Two independent implementations
concluded that "any change clears redo" is too blunt.** That is a finding, not a
detail.

### 5.2 The tree alternative is real and is not what ⌘Z means

Vim keeps the discarded branch:

> This happens when you undo a few changes and then make a new change. The undone
> changes become a branch.

> Note that using 'u' and CTRL-R will not get you to all possible text states
> while repeating 'g-' and 'g+' does.

Note what Vim itself concedes there: **its own `u`/`Ctrl-R` are linear.** The
tree is reachable only through `g-`/`g+`, which are separate keys that a user
opts into. Even the tool famous for tree history did not put the tree behind the
undo key.

### 5.3 Keybindings

**Apple HIG, quoted:**

> Mac users expect to find undo and redo at the top of the Edit menu; they also
> expect to use **Command–Z** and **Shift–Command–Z** to perform undo and redo,
> respectively.

For Windows, I did **not** reach a primary Microsoft source. What I have is
search-summary level: **secondary — unverified** — that `Ctrl+Y` is the classic
Windows/Office redo, that `Ctrl+Shift+Z` is the cross-platform and
creative-tool convention (Adobe, Google Docs), and that in browsers `Ctrl+Y` is
already taken (Firefox opens History). Treat the *direction* as reliable — two
conventions coexist on Windows — and the specifics as unverified.

For a web app the safe reading is: `⌘Z`/`Ctrl+Z` for undo, `⇧⌘Z`/`Ctrl+Shift+Z`
for redo as the primary, `Ctrl+Y` accepted as an alias on Windows only, and
`⌘Y` never bound on macOS.

---

## 6. Stack depth and how memory is bounded

### 6.1 The numbers, with their tags

| tool | limit | tag | source |
|---|---|---|---|
| ProseMirror | `depth` **100** — "The amount of history events that are collected before the oldest events are discarded. Defaults to 100." | **quoted** | `src/history.ts` |
| Quill | `maxStack` **100**; enforced by `if (this.stack.undo.length > this.options.maxStack) { this.stack.undo.shift(); }` | **quoted** | docs + `modules/history.ts` |
| Slate | **100** — `while (undos.length > 100) { undos.shift() }` | **quoted** | `with-history.ts` |
| Procreate | **250** per session | **quoted** | Procreate help |
| Krita | configurable; "You can set the value to 0 for unlimited undo commands" | **quoted** (the default value is **open** — the manual page does not state it) | Krita manual |
| Blender | "Undo Steps: Number of Undo steps available." + "Undo Memory Limit: Maximum memory usage in Mb (0 is unlimited)." | **quoted** (descriptions only; the **default is open** — docs.blender.org 403s and the `.rst` omits it. "32 default / 256 max" is **secondary — unverified**) | manual `.rst` |
| Photoshop | commonly cited as 50 default / 1000 max | **secondary — unverified**; helpx.adobe.com timed out four times | — |
| Qt | `setUndoLimit()`, with the constraint "This property may only be set when the undo stack is empty" | **quoted** | QUndoStack |

**Three of the three JS libraries that publish a number publish exactly 100.**
That is the strongest single convergence in this document.

### 6.2 Two ways to bound, and the better one for image-sized data

GIMP uses both at once, and the description is the clearest articulation of why:

> the *minimal number of undo levels*, which GIMP will maintain regardless of how
> much memory they consume, and the *maximum undo memory*, beyond which GIMP will
> begin to delete the oldest items from the Undo History.

A **floor in steps** plus a **ceiling in bytes**. The floor guarantees the feature
still works on a huge document; the ceiling stops it from eating the machine.
Blender's pair (`Undo Steps` + `Undo Memory Limit`) is the same design.

**This dual bound is what you need when a step can be large.** It is *not* what
you need when steps are cheap and uniform — which is why the text-editing
libraries all use a plain count. **Derived:** Free Stroke's steps are wrapper
objects over shared immutable data, so they are cheap and uniform, and a plain
count is the right instrument. If a step ever came to own a rasterised bitmap or
a baked mesh, this conclusion would flip and the byte ceiling would become
mandatory.

### 6.3 The guideline pulls the other way

Apple:

> **Let people undo multiple times.** Avoid placing unnecessary limits on the
> number of times people can undo or redo. People generally expect to undo every
> action they've performed since taking a logical step like opening a document or
> saving their work.

Note "since opening a document" — Apple's stated expectation is *session-scoped
and unbounded*, not *N-bounded*. Every implementation bounds it anyway, because
memory is real. The honest synthesis: the cap exists for the machine, so **set it
high enough that a normal session never reaches it**, and treat any user hitting
the cap as a sign it was set too low.

---

## 7. Persistence and schema versioning

Secondary to the undo work, but the storage boundary is where a bad payload
becomes a corrupted document, so the two touch.

### 7.1 The versioned envelope

**tldraw** writes a schema descriptor beside the data rather than encoding the
version in a filename or key:

```ts
serialize(): SerializedSchemaV2 {
  return {
    schemaVersion: 2,
    sequences: Object.fromEntries(...)
  }
}
```

The version travels **with** the payload. Note that even the envelope's own
format is versioned (`SerializedSchemaV1 | SerializedSchemaV2`) — they had to
migrate the migration format, which is the argument for putting a version on the
envelope itself and not only on the data.

### 7.2 A payload from a newer version: refuse, don't coerce

Two independent primary sources say the same thing, and both make it an
*outcome*, not a crash.

**IndexedDB** — the web platform's own answer, from MDN's guide:

> One of the common possible errors when opening a database is `VER_ERR`. It
> indicates that the version of the database stored on the disk is *greater* than
> the version that you are trying to open. This is an error case that must always
> be handled by the error handler.

**tldraw** — a named failure reason in the public API:

```ts
export const MigrationFailureReason = {
  IncompatibleSubtype: 'incompatible-subtype',
  UnknownType: 'unknown-type',
  TargetVersionTooNew: 'target-version-too-new',
  TargetVersionTooOld: 'target-version-too-old',
  MigrationError: 'migration-error',
  UnrecognizedSubtype: 'unrecognized-subtype',
} as const
```

and `if (schema.schemaVersion > 2 || schema.schemaVersion < 1) return Result.err('Bad schema version')`.

**Nobody in the reference set reads a newer payload and hopes the extra fields
are harmless.** Forward compatibility is a refusal with a name attached. (Note:
I quoted the enum and the schema-version guard; I did **not** manage to read the
specific call site that emits `TargetVersionTooNew` — the fetcher returned only
part of `migrate.ts`. The existence and naming of the outcome is quoted; its
exact trigger condition is **open**.)

### 7.3 Quarantine, not delete — and it has a citation

This is the finding I was least sure existed and it does, in Chromium's own
preferences reader (`components/prefs/json_pref_store.cc`):

```c
bool BackupPrefsFile(const base::FilePath& path) {
  const base::FilePath bad = path.ReplaceExtension(kBadExtension);
  const bool bad_existed = base::PathExists(bad);
  base::Move(path, bad);
  return bad_existed;
}
```

with `const base::FilePath::CharType kBadExtension[] = FILE_PATH_LITERAL("bad");`
and the rationale in the error handler:

> JSON errors indicate file corruption of some sort. Since the file is corrupt,
> move it to the side and continue with empty preferences... We keep the old file
> for possible support and debugging assistance as well as to detect if they're
> seeing these errors repeatedly.

Three things worth lifting verbatim into any implementation:

1. **Move it aside, don't delete it.** The user's bytes are the only copy.
2. **Continue with empty state.** A corrupt payload must not brick the session.
3. **One slot, and notice when it's already occupied.** `bad_existed` is used to
   distinguish a first corruption (`PREF_READ_ERROR_JSON_PARSE`) from a
   *repeating* one (`PREF_READ_ERROR_JSON_REPEAT`) — because a corruption that
   happens twice is a bug in the writer, not bad luck.

`lib/storage.ts` already implements (1) and (2) with a single overwriting
quarantine slot. It does **not** currently distinguish first-vs-repeat, and
Chromium's reason for doing so is a good one.

---

## 8. What this means for Free Stroke

`lib/undo-stack.ts` and `lib/doc-store.ts` already exist and already reference
this file. So this section does two jobs: confirm what the evidence supports, and
name the places where the evidence says something different from what is built.

### 8.1 Confirmed by the sources

**Snapshot over command — correct here, for the reason given.** §1.2. The
argument holds *because* every mutation site is immutable and there is one
`setStyleState` chokepoint. Add a note to the file that this is a *conditional*
correctness: the first in-place mutation anywhere in the style rails silently
breaks every snapshot above it. That is the invariant to guard.

**`COALESCE_MS = 500`.** Matches ProseMirror's `newGroupDelay` (quoted) and Yjs's
`captureTimeout` (quoted) exactly. Quill's 1000 is the outlier. 500 is the right
pick and is now cited.

**`DEFAULT_DEPTH = 100`.** Matches ProseMirror `depth`, Quill `maxStack` and
Slate's hard cap — all three quoted at exactly 100. Photoshop's rumoured 50 is
lower; Procreate's documented 250 is higher, and Procreate's steps are almost all
brush strokes, which is the closest analogue to ours. **Recommendation: keep 100,
and treat 250 as the number to move to if telemetry or your own use ever hits the
cap.** Derived cost of going to 250: 150 extra wrapper objects sharing all their
stroke data — i.e. negligible, so the cap is a UX choice here, not a memory one.
A byte-ceiling (§6.2) is **not** needed and should not be added unless a step
ever comes to own a bitmap or a baked mesh.

**Key-based coalescing with `key: null` meaning "never merge".** This is exactly
Qt's `id()` contract — merge only between same-ID commands, `-1` for
non-mergeable — arrived at independently. Cite `QUndoCommand::id()` in the file.

**Keeping the FIRST snapshot when coalescing.** Correct, and worth the comment it
already has. The gesture must return to where it started.

**The `future.length === 0` guard on coalescing.** Supported by Yjs's
`!undoing && !redoing` guard, which exists for the same reason.

**Linear redo, destroyed by a new action.** Qt states it as a rule; tldraw's
default `record` mode clears redo; Vim — the tool with a tree — keeps its own
`u`/`Ctrl-R` linear and puts the tree on separate keys. Keep it.

**Transactions (macros).** Qt's "command macros" by another name, and exactly
what `applyGeometrySettings`'s five setters need. Nested-flattening is right.

**History not persisted; dies at reload.** Procreate documents the same behaviour
("forgotten when you return to the Gallery"). Not a compromise.

**Camera not on the stack.** GIMP names zoom as *the* canonical non-undoable.
`lib/doc-store.ts` says "Every drawing tool in the reference set draws this line
in the same place" — that is now defensible for GIMP, Slate and Excalidraw, but
see §8.3: Blender does not, and the claim should be softened to name the test
rather than assert unanimity.

### 8.2 The one change the evidence recommends: bound drags by the gesture, not the clock

§2.4. A 500 ms window alone splits a slow drag into two steps, and the user's
model of "one drag = one undo" has no stopwatch in it. tldraw, Excalidraw and
Cocoa all bound by the interaction instead.

Concretely, and without changing the stack's design:

- **`pointerdown` on any dial opens a transaction; `pointerup`/`pointercancel`
  closes it.** The existing `transaction()` already produces exactly one entry
  for a bracketed run, so the whole drag is one step regardless of duration or
  pauses. This is tldraw's `mark()` at the start of an interaction.
- **Keep the 500 ms key window as the fallback**, for the paths with no pointer
  gesture: keyboard arrow nudges on a focused dial, wheel-over-dial, and any
  programmatic ramp. Those genuinely have no boundary, which is the situation the
  time window was invented for.
- `pointercancel` matters: a drag interrupted by a system gesture must still
  close its transaction, or every subsequent change silently merges into it.

### 8.3 What ⌘Z should and should not reach

Apply the §3.3 test — **is it in the saved file?** — which resolves the
GIMP/Blender disagreement rather than picking a side. Free Stroke's saved file is
defined by `lib/doc-store.ts`: three keys covering strokes, fusions, and session
style/geometry state, with camera and panel state deliberately excluded.

**Undoable (a step, `key: null` unless noted):**

| action | step | coalescing key |
|---|---|---|
| finish a stroke | one step per stroke | `null` |
| click a preset pill (all 15 families) | one step, even though it resets composition rails | `null` |
| drag a style dial | **one step per gesture** (§8.2) | `style:<dialId>` |
| drag a geometry param | one step per gesture | `geom:<paramId>` |
| reorder the layer stack | one step per drop | `null` |
| delete a custom fusion | one step | `null` |
| Clear canvas | one step | `null` |
| change geometry mode | one step (it is persisted state) | `null` |

**Not undoable — and, equally important, must not clear the redo stack:**

| action | why |
|---|---|
| camera orbit / zoom / spin | GIMP: "affect the image display without altering the underlying image data. The most important example is zooming." Not persisted (`doc-store.ts`) |
| opening/closing a panel; switching the active panel | not persisted; `doc-store.ts` states the intent |
| tool switch | not persisted. **Derived from the saved-file test — I found no primary source that states this directly (§3.4)** |
| hover-preview of a preset | ephemeral by definition; Excalidraw's `NEVER` |
| playback transport (play/pause/scrub of style clocks) | view state over a deterministic function |
| restore-from-storage on boot | Excalidraw's `NEVER` covers "scene initialization" verbatim; `undo-stack.ts:reset()` already handles this |

**The redo-preservation rule is separate and must be implemented separately.**
Excalidraw's comment is the warning: it is not enough that these actions push no
undo entry — the code path that clears `future` must never run for them. In the
current implementation `future` is only cleared inside `commit()`, so this is
already satisfied **provided none of the above ever calls `commit()`**. That is
the thing to assert in a test, not to assume.

**One capability the stack does not have and should:** every implementation in
§3.5 has a way to change the document without recording a step. Ours is
"don't call `commit()`", which is an absence rather than a mechanism — it is the
"five chances to miss one" failure the file's own header warns about, pointed the
other way. Consider an explicit `stack.silently(fn)` (tldraw's
`{ history: 'ignore' }`) so that "this write is not a step" is *stated* at the
call site rather than inferred from the absence of a line.

### 8.4 Redo semantics, concretely

- Linear. A new `commit()` clears `future`. Already implemented.
- `undo()`/`redo()` move the label with the entry and swap the snapshot — this is
  right, and it is what lets the UI say "Undo Clear canvas" / "Redo Clear canvas"
  without the two drifting.
- **Consider adopting Excalidraw's no-visible-change skip** (§1.5). If an undo
  step would restore a state indistinguishable from the current one, the user
  reads it as a broken key and presses again. With snapshots this is a shallow
  reference comparison of the snapshot against the live document — cheap. Worth
  it mainly for the coalesced-drag case, where a step whose start and end values
  are equal is possible.
- Bindings: `⌘Z` / `Ctrl+Z` undo; `⇧⌘Z` / `Ctrl+Shift+Z` redo (Apple HIG,
  quoted); accept `Ctrl+Y` on Windows only (secondary); never bind `⌘Y`.
  `components/drawing-canvas.tsx:379` currently bails on `e.shiftKey`, which is
  the "there is no redo anywhere in the app" defect the stack's own header
  describes — that guard has to go for `⇧⌘Z` to reach the handler at all.

### 8.5 Clear canvas and delete-fusion: undoable, and here is the extra clause

§4. Both should be undoable rather than confirmed — Raskin and NN/g agree that
far. But §4.3's corollary applies to both:

- **Clear canvas**: undoable in session. The exposure is *clear, then reload*.
  Either persist a single "last cleared document" slot (which `doc-store.ts`
  already reaches for) or accept the exposure knowingly. Do not add a confirm as
  the primary answer — a confirm on a button sitting next to Undo is the routine
  action NN/g says not to confirm.
- **Delete a fusion**: this is authored work that outlives the session, so a
  session-scoped undo is a weaker guarantee than the object deserves. A durable
  trash slot is the right shape. If there is no durable slot, this is the one
  place in the app where NN/g's carve-out — "destroying users' work" — genuinely
  earns a confirm.

### 8.6 Storage

`lib/storage.ts` already implements the envelope, the future-refusal and the
quarantine, and every one of those three now has a citation: tldraw's serialized
schema (§7.1), IndexedDB's `VER_ERR` and tldraw's `TargetVersionTooNew` (§7.2),
Chromium's `.bad` backup (§7.3). Two small things Chromium does that we do not:

- **Distinguish first corruption from repeat corruption.** Chromium returns
  `PREF_READ_ERROR_JSON_REPEAT` when a `.bad` file already existed, because a
  second corruption means the *writer* is broken. Our single overwriting
  quarantine slot already knows whether it was occupied; it just doesn't say so.
- Chromium's reason for keeping the bytes is worth quoting in the file: "We keep
  the old file for possible support and debugging assistance as well as to detect
  if they're seeing these errors repeatedly."

---

## 9. What I could not establish

Listed so nothing here reads as more settled than it is.

1. **Photoshop's documented history-state default and maximum**, and its
   documented list of non-history changes. `helpx.adobe.com` timed out on four
   attempts across two URLs; `web.archive.org` is blocked by the fetch tool. The
   "50 / 1000" figures are secondary and I did not verify them on an Adobe page.
2. **Blender's default Undo Steps and its maximum.** `docs.blender.org`,
   `developer.blender.org` and `devtalk.blender.org` all returned 403. The
   manual's `.rst` source gave the descriptions but not the defaults.
3. **Blender's undo-push categories** (which operators push undo steps and which
   don't) — the developer docs are the only place this is written down and they
   were unreachable.
4. **Figma's own documented statement** of what is and is not undoable. I found
   no official help-centre article; searches returned only third-party tutorials,
   which I have not cited. Figma appears here only via its engineering blog and
   plugin API, both of which I did read.
5. **Material Design's position** on snackbar-with-undo vs confirmation. Both
   `m2.` and `m3.material.io` return JS shells with no text to the fetcher.
6. **Automerge's undo semantics** from a primary source. Only a search summary
   was obtained; Yjs carries the CRDT section instead.
7. **Exactly where in Excalidraw's `App.tsx`** each `CaptureUpdateAction` value is
   applied during a pointer drag. The file was too large for the fetcher to
   search exhaustively and it said so. The *definition* of the three values is
   quoted; the claim about the specific handlers is not.
8. **The precise call site that emits tldraw's `TargetVersionTooNew`.** The enum
   and the schema-version guard are quoted; the trigger condition is inferred
   from the name.
9. **A primary Microsoft source** on `Ctrl+Y` vs `Ctrl+Shift+Z`. Direction is
   reliable, specifics are secondary.
10. **Whether a tool switch is documented anywhere as non-undoable.** No primary
    source found. §8.3's entry is derived from the saved-file test, not quoted.
11. **Krita's and GIMP's default undo-level values.** The mechanisms are quoted;
    GIMP's preferences pages 404'd at the paths tried and Krita's manual states
    the semantics without the default.

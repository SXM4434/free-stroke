/**
 * THE UNDO STACK — past / future over whole-document snapshots.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT WAS HERE BEFORE, AND WHY IT WAS NOT SELLABLE
 *
 *   · ⌘Z popped the last STROKE and nothing else.
 *   · ⇧⌘Z was explicitly swallowed (`drawing-canvas.tsx:350` bailed on
 *     `e.shiftKey`) — there was no redo anywhere in the app.
 *   · Preset undo was ONE slot, a `useRef` in `app/page.tsx`, reachable only by
 *     clicking an action inside a toast before that toast dismissed. It had no
 *     keyboard binding at all.
 *   · That one slot covered the GEOMETRY and VIEW families only. The other
 *     thirteen — every composition family — had no undo, and those are the
 *     destructive ones, because `applyPresetToStyleState` resets every
 *     composition rail before it applies a preset's patch. The families that
 *     wipe your work were exactly the families you could not undo.
 *   · Clear wrote `[]` straight through to `localStorage` with no snapshot and
 *     no confirm, from a button sitting next to Undo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SNAPSHOT, NOT COMMAND — and why that is the right call HERE
 *
 * The textbook answer is the command pattern: record a do/undo pair per action.
 * It is the right answer when snapshots are expensive or when history must be
 * rebased against a concurrent editor. Neither is true here:
 *
 *   · Free Stroke's document is a handful of plain objects plus two arrays of
 *     strokes, and every one of them is already treated as IMMUTABLE (every
 *     mutation site does `{ ...s, field }` or `[...prev, next]`). So a
 *     "snapshot" is a shallow object of existing references — bytes copied are
 *     the size of the wrapper, not of the drawing. Fifty snapshots of a
 *     200-stroke drawing share all 200 strokes.
 *   · There is one document and one editor. No rebasing, no transform.
 *   · A command pair has to be written PER MUTATION SITE, and the mutation
 *     sites are the problem: the whole style panel writes through a single
 *     `setStyleState` prop. A snapshot model needs one interception point; a
 *     command model needs one per control, which is the same "five chances to
 *     miss one" that `app/page.tsx` already calls out about fusion saves.
 *
 * So: entries hold the document as it was BEFORE an action, and undo restores
 * it. The stack never owns the live state — it is handed the current document
 * on every call — which is what lets it sit outside React entirely.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ENTRY, AND WHY THE LABEL TRAVELS WITH THE ACTION
 *
 * An entry is `{ label, snapshot }` where `label` names the ACTION and
 * `snapshot` is the state on the far side of it. Moving between stacks keeps
 * the label and swaps the snapshot:
 *
 *   past  { "Clear canvas", before }   --undo-->  future { "Clear canvas", after }
 *   future{ "Clear canvas", after  }   --redo-->  past   { "Clear canvas", before }
 *
 * so both directions can say what they are about to do, by the same name, and
 * "Undo Clear canvas" cannot drift from "Redo Clear canvas".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COALESCING — the one design question that actually matters
 *
 * A dial drag fires a change per pointer sample. Recorded naively that is ~40
 * undo steps for one gesture, and ⌘Z becomes useless: the user presses it
 * expecting to leave the dial where it was and instead walks it back a pixel at
 * a time. Every editor solves this the same way — a new step is started only
 * when the change is of a DIFFERENT KIND, or when enough time has passed.
 *
 * THE RESEARCH FOUND THREE MECHANISMS, NOT ONE, and they disagree — see
 * `docs/research/undo-redo-conventions.md`. Both of the ones that apply here
 * are implemented, because either alone is wrong:
 *
 *   1 · IDENTITY. `key` is what is being changed (`"style:textureScale"`,
 *       `"geom:extrudeDepth"`). Only commits sharing a key can merge. This is
 *       Qt's `QUndoCommand::id()` rule, where `-1` means never-merge — which is
 *       exactly what a null `key` means here. Discrete actions (a preset click,
 *       a stroke, Clear, a delete) pass null: they are steps by definition, and
 *       two fast clicks on two different pills must be two steps even though
 *       they arrive inside any window.
 *
 *   2 · THE GESTURE BOUNDARY. `beginGesture` / `endGesture` bracket a pointer
 *       drag, and inside that bracket the TIME WINDOW DOES NOT APPLY. This is
 *       what every graphics tool in the reference set actually uses — tldraw
 *       ("Create marks at the start of user interactions"), Excalidraw
 *       (`CaptureUpdateAction` explicitly excepting "ephemerals such as
 *       dragging or resizing"), and Cocoa's `NSUndoManager.groupsByEvent`.
 *
 *   3 · THE TIME WINDOW, `COALESCE_MS`, as the FALLBACK for changes that have
 *       no gesture to bracket: an arrow-key nudge, a wheel tick, a colour
 *       picker firing outside the page's pointer stream. 500 ms is what
 *       ProseMirror (`newGroupDelay`) and Yjs (`captureTimeout`) both use.
 *
 * ⚠ A TIME WINDOW ALONE IS NOT ENOUGH, AND THIS IS THE ONE THING THE RESEARCH
 * CHANGED. A user dragging a dial slowly — pausing to look at the render, which
 * is the entire point of a dial in this app — crosses 500 ms without lifting
 * the pointer, and a window-only implementation splits that ONE gesture into
 * several undo steps. `assert-data-safety.mjs` §2.5 and §3.6b hold the drag
 * open past the window deliberately, and they fail without the bracket.
 *
 * The merged step keeps the FIRST snapshot — the state to return to is where
 * the gesture started, not where its second-to-last sample was.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REDO IS DESTROYED BY A NEW ACTION
 *
 * Undo three steps, then draw: the three redos are gone. This is linear
 * history, and it is what every tool in the reference set does. The tree-history
 * alternative (keep both branches) is a real design with real users, and it is
 * not what a ⌘Z key means to anyone who has not opted into it.
 */

/**
 * Depth cap. ProseMirror's `depth` and Quill's `maxStack` are both 100, and
 * Slate's default history is 100 — the three independent implementations the
 * research reached agree, so 100 it is. Snapshots here are shallow objects of
 * shared references, so a hundred of them costs a hundred wrappers, not a
 * hundred drawings. (`docs/research/undo-redo-conventions.md` §6.)
 */
export const DEFAULT_DEPTH = 100

/**
 * Coalescing window, ms. ProseMirror's `newGroupDelay` and Yjs's
 * `captureTimeout` are both 500; Quill uses 1000. It is the FALLBACK here, not
 * the primary mechanism — see the gesture bracket above.
 * (`docs/research/undo-redo-conventions.md` §2.)
 */
export const COALESCE_MS = 500

export interface UndoEntry<S> {
  /** Names the ACTION, not the state. Shown as "Undo <label>". */
  label: string
  /** The document on the far side of that action. */
  snapshot: S
  /** Coalescing identity, or null for a step that never merges. */
  key: string | null
  /** Epoch ms of the last commit folded into this entry. */
  at: number
  /** Which pointer gesture produced this entry, or null if it was not made
   *  inside one. Two different gestures never merge, however close in time. */
  gesture: number | null
}

export interface CommitOptions {
  label: string
  /** Null (the default) means "this is its own step, always". */
  key?: string | null
  /** Injectable clock, so the coalescing window is testable without waiting. */
  now?: number
}

export interface UndoState {
  canUndo: boolean
  canRedo: boolean
  /** What ⌘Z would undo, or null. */
  undoLabel: string | null
  /** What ⇧⌘Z would redo, or null. */
  redoLabel: string | null
  depth: number
  redoDepth: number
}

export class UndoStack<S> {
  private past: UndoEntry<S>[] = []
  private future: UndoEntry<S>[] = []
  private listeners = new Set<() => void>()
  /**
   * Transaction nesting. While > 0, `commit` records at most ONE entry — the
   * first — and ignores the rest.
   *
   * THIS IS NOT AN OPTIMISATION. `applyGeometrySettings` in `app/page.tsx`
   * writes five React setters in a row to apply one preset. Without a
   * transaction that is five undo steps for one click, four of which land the
   * user in a geometry state that never existed on screen — half a preset
   * applied. A step the user cannot recognise is worse than no step.
   */
  private depthInTx = 0
  private txCommitted = false

  /**
   * A pointer gesture is in progress. While this is true, a commit sharing the
   * top entry's key merges into it NO MATTER HOW LONG THE DRAG HAS RUN — the
   * bracket, not the clock, decides where the step ends.
   *
   * Counted rather than boolean: a pointercancel arriving after a pointerup, or
   * two capture-phase listeners on nested elements, must not leave a gesture
   * stuck open. A stuck-open gesture would merge every later dial move into one
   * enormous step, which is a worse failure than splitting one.
   */
  private gestureDepth = 0

  /**
   * ⚠ A GESTURE NEEDS AN IDENTITY, NOT JUST A FLAG — and this cost a real bug.
   *
   * The first version only tracked whether a bracket was open. Then
   * `assert-data-safety.mjs` §3.6b dragged the SAME slider twice in a row, with
   * a genuine pointerup between them, and the second drag added ZERO steps: the
   * top entry still carried that slider's key, a bracket was open again, so the
   * second gesture merged into the FIRST one's entry. Two deliberate gestures,
   * one undo step, and ⌘Z jumping back further than the user asked.
   *
   * So each bracket gets a serial number and an entry remembers which gesture
   * produced it. Merging requires the SAME gesture, not merely "some gesture".
   * A pointerup is a boundary because the next pointerdown is a different
   * number — which is what a gesture boundary means.
   */
  private gestureSeq = 0
  private currentGesture: number | null = null

  constructor(
    private readonly maxDepth: number = DEFAULT_DEPTH,
    private readonly coalesceMs: number = COALESCE_MS,
  ) {}

  /* ---- subscription (for React's useSyncExternalStore) ------------------ */

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private cached: UndoState | null = null

  /** Stable identity between changes — `useSyncExternalStore` re-renders
   *  forever if this allocates a fresh object on every read. */
  getState = (): UndoState => {
    if (!this.cached) {
      const top = this.past[this.past.length - 1]
      const next = this.future[this.future.length - 1]
      this.cached = {
        canUndo: this.past.length > 0,
        canRedo: this.future.length > 0,
        undoLabel: top ? top.label : null,
        redoLabel: next ? next.label : null,
        depth: this.past.length,
        redoDepth: this.future.length,
      }
    }
    return this.cached
  }

  private emit() {
    this.cached = null
    for (const fn of this.listeners) fn()
  }

  /* ---- recording -------------------------------------------------------- */

  /**
   * Record the document as it stands BEFORE an action. Call this at the top of
   * a mutating handler, with the state you are about to change.
   *
   * Returns true if a new step was opened, false if it merged into the one
   * above it (coalesced, or suppressed inside a transaction).
   */
  commit(before: S, opts: CommitOptions): boolean {
    const now = opts.now ?? Date.now()
    const key = opts.key ?? null

    if (this.depthInTx > 0) {
      if (this.txCommitted) return false
      this.txCommitted = true
    }

    const gesture = this.gestureDepth > 0 ? this.currentGesture : null
    const top = this.past[this.past.length - 1]
    /* MERGEABLE means: same control, and either the same pointer gesture, or —
     * for changes with no gesture at all (arrow keys, a wheel, a colour picker
     * outside the page's pointer stream) — inside the time window. An entry
     * BORN in a gesture is never extended from outside one, which is what stops
     * a stray keypress after a drag from being folded into it. */
    const sameGesture = gesture !== null && top?.gesture === gesture
    const windowed = gesture === null && top?.gesture === null && now - (top?.at ?? 0) <= this.coalesceMs
    if (key !== null && top && top.key === key && (sameGesture || windowed) && this.future.length === 0) {
      /* SAME dial, still moving. Keep the entry's ORIGINAL snapshot — the
       * whole gesture returns to where it started — and only extend its
       * window. `future.length === 0` is required because a coalesce is a
       * silent no-op, and merging into an entry that sits below a live redo
       * stack would leave that redo stack pointing at a document that no
       * longer follows from it. */
      top.at = now
      return false
    }

    this.past.push({ label: opts.label, snapshot: before, key, at: now, gesture })
    if (this.past.length > this.maxDepth) this.past.splice(0, this.past.length - this.maxDepth)
    /* Any real step invalidates redo. Linear history. */
    if (this.future.length) this.future.length = 0
    this.emit()
    return true
  }

  /** A pointer went down on a continuous control. Each bracket gets its own
   *  serial, so the next drag on the same dial is a NEW step. */
  beginGesture() {
    if (this.gestureDepth === 0) {
      this.gestureSeq += 1
      this.currentGesture = this.gestureSeq
    }
    this.gestureDepth += 1
  }

  /** The pointer came up, or the gesture was cancelled. Idempotent below zero. */
  endGesture() {
    if (this.gestureDepth > 0) this.gestureDepth -= 1
    if (this.gestureDepth === 0) this.currentGesture = null
  }

  /** Diagnostic — an assertion has to be able to prove the bracket is actually
   *  open during the drag it is measuring, not merely that a number came out. */
  gestureOpen(): boolean {
    return this.gestureDepth > 0
  }

  /**
   * Run `fn` as ONE undo step. Nested transactions are flattened, so a preset
   * that internally applies a geometry change still produces a single entry.
   */
  transaction<R>(fn: () => R): R {
    const outermost = this.depthInTx === 0
    this.depthInTx += 1
    if (outermost) this.txCommitted = false
    try {
      return fn()
    } finally {
      this.depthInTx -= 1
      if (this.depthInTx === 0) this.txCommitted = false
    }
  }

  /* ---- traversal -------------------------------------------------------- */

  /**
   * Step back. `current` is the live document, which becomes the redo target.
   * Returns the snapshot to restore, or null if there is nothing to undo.
   */
  undo(current: S): { snapshot: S; label: string } | null {
    const entry = this.past.pop()
    if (!entry) return null
    this.future.push({ label: entry.label, snapshot: current, key: entry.key, at: Date.now(), gesture: null })
    if (this.future.length > this.maxDepth) this.future.splice(0, this.future.length - this.maxDepth)
    this.emit()
    return { snapshot: entry.snapshot, label: entry.label }
  }

  /** Step forward. Mirror of `undo`. */
  redo(current: S): { snapshot: S; label: string } | null {
    const entry = this.future.pop()
    if (!entry) return null
    this.past.push({ label: entry.label, snapshot: current, key: entry.key, at: Date.now(), gesture: null })
    if (this.past.length > this.maxDepth) this.past.splice(0, this.past.length - this.maxDepth)
    this.emit()
    return { snapshot: entry.snapshot, label: entry.label }
  }

  /**
   * Forget everything. Used only when the document is REPLACED wholesale — a
   * restore from storage on boot — because history against a document you are
   * no longer holding would undo INTO a state the user never saw.
   */
  reset() {
    this.past.length = 0
    this.future.length = 0
    this.emit()
  }

  /** Labels, oldest first. Diagnostic — this is what an assertion reads to
   *  prove a drag became ONE step rather than forty. */
  labels(): { past: string[]; future: string[] } {
    return {
      past: this.past.map((e) => e.label),
      future: this.future.map((e) => e.label),
    }
  }
}

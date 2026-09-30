"use client"

import { Component, type ReactNode } from "react"

/* ---- Error boundary ----
 *
 * IT USED TO PRINT THE RAW `error.message` AND NOTHING ELSE. On this surface
 * that string is something like "Cannot read properties of undefined (reading
 * 'array')" or a GLSL compile log — true, useless to the person reading it, and
 * the only thing on screen. A product's crash state has to answer three
 * questions in order: what happened, what can I do, and what do I tell whoever
 * fixes it. So the headline is in English, the recovery is a real button, and
 * the technical detail is kept — folded, monospace, selectable — because it is
 * the one thing that is worth pasting into a bug report.
 *
 * `retries` exists because "Retry" that silently does nothing the second time is
 * worse than no button: if the same boundary trips again the copy changes and
 * points at a full reload, which is the only thing that clears a dead GL
 * context.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ⚠ WHY IT LIVES IN ITS OWN FILE, WHICH IS THE WHOLE POINT OF THIS MODULE.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * It used to be declared inside `components/viewport-3d.tsx` and rendered BY
 * `Viewport3D`, inside that component's own returned JSX. **A React error
 * boundary catches errors thrown by its CHILDREN, and `Viewport3D`'s own render
 * body is its PARENT** — so it was structurally incapable of catching the
 * failure class it was written for. Proved, not argued: a forced throw from a
 * poisoned stroke (`__styleHarness.crashViewport`) produced
 *
 *     at get points                            (app/page.tsx — the dev law)
 *     at penTimeDistanceFraction               (lib/pen-reveal.ts)
 *     at measureTimingCharacter
 *     at Viewport3D.useMemo[timingCharacter]   <- Viewport3D's OWN body
 *     at Viewport3D
 *
 * and what the user got was `canvases 0` and Next.js's global *"Application
 * error: a client-side exception has occurred"* white screen — losing the
 * drawing — instead of the "Rebuild the view" card written for exactly this.
 * `scripts/verify/assert-shell-states.mjs` §2 is the gate, and it carries that
 * stack in its own comment.
 *
 * ── AND WHY IT IS NOT SIMPLY EXPORTED FROM `viewport-3d.tsx` ──────────────
 *
 * `components/viewport-3d-wrapper.tsx` is where the boundary has to be applied,
 * because that is the only place ABOVE `Viewport3D`. But that file imports the
 * viewport through `next/dynamic` with `ssr: false` precisely so its ~10,000
 * lines of three.js, R3F, drei and the GLTF exporter stay out of the initial
 * chunk — and its type imports are `import type`, which erase. A VALUE import
 * of the boundary from that module would pull the whole engine back into the
 * wrapper's static graph and undo the split, which is what `ViewportLoading`
 * exists to cover. A class component with no dependency beyond React is the one
 * thing that can sit on both sides of that seam, so it sits in its own file.
 *
 * Moved verbatim — copy, do not recreate. The one thing that changed is
 * `rebuild()`, and its own doc says why.
 */
interface ErrorBoundaryProps { children: ReactNode }
interface ErrorBoundaryState { hasError: boolean; error: string | null; retries: number }

export class ViewportErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, retries: 0 }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // The stack is the half that actually locates the fault, and React only
    // ever hands it here. Logged rather than rendered.
    console.error("[FreeStroke Viewport] crashed:", error, info?.componentStack)
  }
  /**
   * THE RESET IS TAKEN OFF THE CLICK'S OWN SYNCHRONOUS FLUSH — and the reason
   * written here for years was wrong, so it is replaced rather than trimmed.
   *
   * It used to say: resetting inline (`onClick={() => this.setState(...)}`) made
   * React throw "Should not already be working." out of the root scheduler,
   * because remounting the viewport re-enters a sync flush while
   * `@react-three/fiber`'s reconciler is already working, and that deferring by
   * one task removed it — "page errors 1 -> 0". **That does not reproduce, in
   * either direction.** `_probe-root-wedge.mjs` with `rebuild()` mutated back to
   * an inline reset: page errors 0, recovery works, canvases 1 -> 2, drawing
   * intact. And with the deferral in place the same error still fires anyway
   * (arm A below) — because it never had anything to do with the click. Both
   * shapes measure identically on every channel available: page errors, the
   * FiberRoot's lanes, the canvas count, the drawing.
   *
   * So the deferral is NOT load-bearing, and this note exists so nobody re-earns
   * that finding. It is kept because between two shapes that measure the same,
   * remounting a GL surface off the click's own flush is the safer one, and the
   * measurement above covers the crash the dev law delivers rather than every
   * crash there is. Kept on evidence about the choice, not on the old claim.
   *
   * ── THE REBUILD DOES WORK. THE PARAGRAPH THAT USED TO SAY OTHERWISE WAS ──
   * ── RIGHT ABOUT THE SYMPTOM AND WRONG ABOUT THE CAUSE. ──────────────────
   *
   * It said: "after a render-phase throw the React root stops committing ANY
   * update", proved by `__styleHarness.injectStrokes` with a different point
   * count leaving the page's readout at `raw 41 pts`. That symptom reproduces
   * exactly. Its cause is not this component, not the boundary, and not the
   * render phase — and it does not exist in a production build at all.
   *
   * `scripts/verify/_probe-root-wedge.mjs` runs the SAME law twice, changing one
   * thing: whether `console.timeStamp` exists when react-dom initialises.
   *
   *   A · as shipped     raw 41 -> 41 · FiberRoot.pendingLanes stuck at 34 ·
   *                      "Should not already be working." · card never clears
   *   B · one variable    raw 41 -> 81 · pendingLanes 0 · zero page errors ·
   *       removed         the card clears, canvases 1 -> 2, and the viewport
   *                       comes back rendering the drawing
   *
   * That one variable is React's **dev-only Performance Track**. The crash law
   * poisons a stroke with a `points` getter that throws on EVERY read, and React
   * DOM's development build reads it a second time, from its own instrumentation,
   * to build a props diff for the DevTools timeline:
   *
   *     at get points                    (app/page.tsx — the law)
   *     at addObjectDiffToProperties     ×3   (walks props -> array -> stroke)
   *     at logComponentRender
   *     at commitPassiveMountOnFiber     <- the COMMIT phase, not render
   *
   * No error boundary can catch that: it is not in anyone's render. And it is
   * fatal because `flushPassiveEffects` sets `executionContext |= CommitContext`
   * before the passive effects and restores it on the line AFTER them, while its
   * `finally` restores only `ReactDOMSharedInternals.p` and
   * `ReactSharedInternals.T`. A throw out of `commitPassiveMountOnFiber` skips
   * the restore, so `executionContext` keeps `CommitContext` forever and every
   * later flush hits `performWorkOnRoot`'s "Should not already be working."
   * invariant. That is the wedge, and it is React's, not ours.
   *
   * `logComponentRender` and `addObjectDiffToProperties` appear **zero times** in
   * `react-dom-client.production.js`. A shipped build has no such reader, and a
   * real crash — a null deref in a geometry memo, a bad uniform — leaves plain
   * data in props rather than a getter that throws forever. So the failure class
   * this card exists for recovers, and the button that recovers it is real.
   *
   * `assert-shell-states.mjs` §2 drives the recovery with that instrumentation
   * off, for the same reason it dismisses toasts through their close button
   * instead of `.remove()`: a gate must not be the thing breaking the app it is
   * measuring.
   */
  rebuild() {
    setTimeout(() => {
      this.setState((s) => ({ hasError: false, error: null, retries: s.retries + 1 }))
    }, 0)
  }
  /**
   * A REBUILD THAT HELD IS NOT A RETRY ANY MORE.
   *
   * `retries` drives two things — the "it stopped again" copy, and whether the
   * Reload button appears — and it only ever counted button presses. While the
   * rebuild could not work that was harmless, because a press was always
   * followed by a failure. Now that it works, a session that crashed once,
   * recovered, and then met an unrelated fault an hour later would be told "it
   * stopped again in the same place" and pointed at a reload it does not need.
   * Copy that does not describe what happened is the defect this file's own
   * header is about.
   *
   * `again` therefore means "the rebuild was pressed and did NOT hold". If the
   * children threw again, React re-derives `hasError: true` before this runs and
   * the count stands.
   */
  componentDidUpdate(_prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState) {
    if (prevState.hasError && !this.state.hasError && this.state.retries > 0) {
      this.setState({ retries: 0 })
    }
  }
  render() {
    if (this.state.hasError) {
      const again = this.state.retries > 0
      return (
        <div className="flex h-full w-full items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-sm">
            <p className="text-sm font-semibold text-foreground">
              The 3D view stopped
            </p>
            {/* ⚠ THE OLD SECOND-FAILURE COPY ENDED "Your drawing is not saved,
                so copy anything you need first." THAT WAS NOT TRUE, and it is
                the worst kind of untrue: it tells someone their work is gone at
                the moment they are deciding whether to risk a reload.
                `app/page.tsx` autosaves `rawStrokes` through
                `writeVersioned(strokesSchema, …)` on every change and restores
                them at boot. Measured (`_probe-root-wedge.mjs` arm C, and
                `assert-shell-states.mjs` §2's last row): raw 57 pts, reload,
                raw 57 pts. The one case where it IS lost is a failed autosave,
                and that path already raises its own 20-second toast saying so
                in stronger terms — it does not need a second, vaguer warning
                here. */}
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {again
                ? "It stopped again in the same place, so rebuilding will not clear it. Reload the page. Your drawing is autosaved in this browser and comes back with it."
                : "Something in the scene threw while rendering. Your strokes are still here. Rebuilding the view usually recovers it."}
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => this.rebuild()}
                className="fs-press rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                Rebuild the view
              </button>
              {again && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="fs-press rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  Reload the page
                </button>
              )}
            </div>
            {this.state.error && (
              <details className="mt-3 border-t border-border/60 pt-2">
                <summary className="cursor-pointer select-none text-[11px] text-muted-foreground hover:text-foreground">
                  Technical detail
                </summary>
                <p className="mt-1.5 max-h-24 select-text overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-muted-foreground/80">
                  {this.state.error}
                </p>
              </details>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ViewportErrorBoundary

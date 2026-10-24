/**
 * THE PEN FIELD, BAKED OFF THE MAIN THREAD.
 *
 * A message pump and nothing else. Every decision — when a bake is worth
 * deferring, what to hold on screen while it runs, what to do when the worker
 * dies — lives in `lib/pen-field-defer.ts`. The bake itself lives in
 * `lib/flat-ink.ts` §PF-W, beside `buildPenField`, and this calls THAT function
 * rather than carrying a copy of it. Two implementations of one bake is how
 * "faster" quietly becomes "different", and the entire claim here is that the
 * output is byte-identical.
 *
 * WHY IDENTICAL AND NOT MERELY CLOSE. A worker is the same V8 running the same
 * module: IEEE-754 doubles with specified rounding, `Math.hypot` and
 * `Math.atan2` the same implementations, the same operations in the same order
 * on the same inputs, and coordinates transferred as `Float64Array` so nothing
 * is rounded in transit. `scripts/verify/assert-penfield-offthread.mjs` does not
 * take that on argument — it bakes the same strokes both ways, hashes every
 * byte of both `Float32Array`s, asserts WHICH PATH produced each, and requires
 * a different input to produce a different hash.
 *
 * ⚠ NOTHING IN `lib/flat-ink.ts` MAY IMPORT THE SCHEDULER. This worker imports
 * that module, so a `new Worker(new URL(…))` expression there would close a
 * module cycle through a worker entry — which deadlocks Turbopack with no error
 * printed and `tsc` green throughout (explainer 20 §8). That is why the
 * scheduler is its own file.
 */
import { runPenFieldWorkerRequest, type PenFieldWorkerRequest } from "./flat-ink"

/**
 * `self` inside a dedicated worker. This project's tsconfig loads the `dom`
 * lib and not `webworker`, so `self` is typed as a Window — whose `postMessage`
 * takes a `targetOrigin` and would not accept a transfer list. Declaring the
 * two members actually used is narrower and safer than casting the call site.
 */
interface WorkerScope {
  onmessage: ((e: MessageEvent<PenFieldWorkerRequest>) => void) | null
  postMessage(message: unknown, transfer: Transferable[]): void
}

const ctx = self as unknown as WorkerScope

ctx.onmessage = (e: MessageEvent<PenFieldWorkerRequest>) => {
  const req = e.data
  try {
    const { reply, transfer } = runPenFieldWorkerRequest(req)
    ctx.postMessage(reply, transfer)
  } catch (err) {
    /* A throw here would strand the caller waiting forever, and the caller is
     * the frame loop. Report it instead; the scheduler finishes that bake on
     * the main thread — slow, never wrong, never missing. */
    ctx.postMessage(
      {
        id: req?.id ?? -1,
        data: null,
        width: 0,
        height: 0,
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        unitsPerTexel: 0,
        radius: 0,
        msTotal: 0,
        error: String(err instanceof Error ? err.message : err).slice(0, 300),
      },
      [],
    )
  }
}

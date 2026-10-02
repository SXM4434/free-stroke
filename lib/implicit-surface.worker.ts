/**
 * THE IMPLICIT SURFACE, BUILT OFF THE MAIN THREAD.
 *
 * This file is a message pump and nothing else. Every decision — what to build,
 * what to keep, when a build is worth deferring at all — lives in
 * `lib/implicit-surface.ts` §7, beside the polygoniser it drives. The rule that
 * keeps this honest: the worker must not be a SECOND implementation of the
 * build. It calls `runImplicitWorkerRequest`, which calls
 * `polygoniseCapsuleFieldBuffers`, which is the same function the synchronous
 * path calls. Two implementations of one build is how "faster" quietly becomes
 * "different", and the whole point here is that the output is byte-identical.
 *
 * WHY THE OUTPUT IS IDENTICAL AND NOT MERELY CLOSE. A worker is the same V8
 * running the same module. JavaScript arithmetic is IEEE-754 doubles with
 * specified rounding, `Math.sqrt` is correctly rounded by spec, and the
 * polygoniser performs the same operations in the same order on the same
 * inputs. The inputs arrive as `Float64Array`, so no precision is lost in
 * transit. `scripts/verify/assert-geom-offthread.mjs` does not take that on
 * argument: it builds the same mark both ways and compares positions, normals
 * and indices byte for byte, with a mutated arm that must FAIL.
 *
 * Turbopack/webpack resolve `new Worker(new URL("./implicit-surface.worker.ts",
 * import.meta.url), { type: "module" })` into a real chunk. If that ever stops
 * working the constructor throws, §7 catches it, and every build runs
 * synchronously again — slow, never wrong.
 */
import { runImplicitWorkerRequest, type ImplicitWorkerRequest } from "./implicit-surface"

/**
 * `self` inside a dedicated worker. The project's tsconfig loads the `dom`
 * lib, not `webworker`, so `self` is typed as a Window — whose `postMessage`
 * has a different signature (`targetOrigin`) and would not accept a transfer
 * list. Declaring the two members actually used is narrower and safer than
 * casting the call site to `any`.
 */
interface WorkerScope {
  onmessage: ((e: MessageEvent<ImplicitWorkerRequest>) => void) | null
  postMessage(message: unknown, transfer: Transferable[]): void
}

const ctx = self as unknown as WorkerScope

ctx.onmessage = (e: MessageEvent<ImplicitWorkerRequest>) => {
  const req = e.data
  try {
    const { reply, transfer } = runImplicitWorkerRequest(req)
    ctx.postMessage(reply, transfer)
  } catch (err) {
    // A throw here would otherwise strand the caller waiting forever. Report
    // it; §7 finishes that build on the main thread instead.
    ctx.postMessage(
      {
        id: req?.id ?? -1,
        positions: null,
        normals: null,
        indices: null,
        revealKeys: null,
        stats: null,
        error: String(err instanceof Error ? err.message : err).slice(0, 300),
      },
      [],
    )
  }
}

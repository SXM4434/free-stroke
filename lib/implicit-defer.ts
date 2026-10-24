/**
 * THE DEFERRED IMPLICIT BUILD — the scheduler, the cache and the worker.
 *
 * THE DEFECT THIS FILE EXISTS FOR. Touching any dial that changes the strokes —
 * wobble, endpoint, spacing — rebuilds the implicit surface, and the rebuild is
 * synchronous inside React's render. Measured on the real page
 * (`scripts/verify/_probe-dial-latency.mjs`, 2026-08-01): one wobble nudge = one
 * geometry build = a **1226-1254 ms blocked main thread** and a **1450-1525 ms
 * gap between rendered frames**. The same nudge on the Desk Doodles engine,
 * which does not polygonise a field, costs 17-33 ms.
 *
 * WHERE THE SECOND GOES, sampled by V8 rather than guessed
 * (`scripts/verify/_probe-dial-cpu.mjs`, CDP `Profiler`, self-time per function):
 *
 *     739 ms  CapsuleField.sdSegment      the exact round-cone distance
 *     297 ms  CapsuleField.eval           the bucket walk + run folding
 *      93 ms  polygoniseCapsuleField      marching, allocation, sorting
 *     104 ms  buildPenField               ← NOT geometry; lib/pen-reveal.ts
 *      67 ms  nibHalfWidth                ← same, the pen's own field
 *
 * Two thirds of the freeze is field evaluation. The engine's own stopwatch
 * (`INFLATE_DEBUG.msBuildTotal`) reads ~600 ms for the same gesture, so the
 * engine can only SEE half of what it costs — which is why the fix had to be
 * chosen off a profile and not off that number.
 *
 * WHY NOT ANY OF THE CHEAPER LEVERS. They were priced first, in
 * `docs/research/off-thread-geometry.md`:
 *   - resolution 3 during the drag still costs 158 ms in node (~320 ms here) —
 *     ten frames, on every step of the drag;
 *   - a cache does nothing for a value never visited before, which is every
 *     value the first time;
 *   - debouncing turns twenty freezes into one freeze;
 *   - making `sdSegment` faster is worth maybe 2x and cannot reach 60 fps.
 * None of them make the page RESPOND. Only moving the work off the thread does,
 * and it is the one answer whose output can be byte-identical by construction.
 *
 * WHY THE SWAP DOES NOT GO THROUGH REACT. `useStrokeMeshes` is a `useMemo`:
 * whatever it returns must be returned synchronously, and React will not
 * re-render when a worker finishes because no state changed. So the swap goes
 * through THREE instead: the deferred call hands back the geometry that is
 * ALREADY on screen — the same `THREE.BufferGeometry` instance — and when the
 * worker lands, that instance's attributes are replaced in place. three.js
 * reads the geometry every frame, so the new surface appears on the next
 * rendered frame with no React involvement. The mark never blanks; it holds its
 * last good shape and then changes.
 *
 * WHAT IS DELIBERATELY *NOT* DEFERRED, so nothing that reads geometry
 * immediately can read a stale one:
 *   - EXPORT. `buildExport` never touches this path; a GLB is always the full
 *     synchronous build. That is what keeps `geometry-baseline`'s `exportBytes`
 *     an honest byte-level check.
 *   - THE FIRST BUILD OF A SLOT. With nothing on screen to hold, there is
 *     nothing to defer TO, so a new drawing always builds synchronously.
 *   - ANY BUILD THAT WAS NOT MEASURED EXPENSIVE. A slot only starts deferring
 *     once one of its builds has been observed to cost `minCostMs` or more.
 *     Every synthetic fixture in the verification battery builds in tens of
 *     milliseconds and therefore never leaves the synchronous path — the gates
 *     see exactly what they saw before.
 *
 * ⚠ WHY THIS IS A SEPARATE FILE FROM `implicit-surface.ts`. The worker imports
 * that module; if the `new Worker(new URL(...))` expression also lived there,
 * the module graph would contain a cycle through a worker entry and TURBOPACK
 * DEADLOCKS ON IT — `Ready in 186ms`, then `Compiling / ...` forever, every
 * tokio worker parked in `_pthread_cond_wait` at 0% CPU, no error printed, and
 * `tsc` green the whole time. Bisected in both directions 2026-08-01; see the
 * §7 note in `lib/implicit-surface.ts`. Nothing in `implicit-surface.ts` may
 * import this file.
 */
import * as THREE from "three"
import {
  polygoniseCapsuleFieldBuffers,
  implicitBuffersToGeometry,
  applyImplicitZAspect,
  packCapsules,
  unpackCapsules,
  type ImplicitCapsule,
  type ImplicitBuildOptions,
  type ImplicitBuildResult,
  type ImplicitBuildBuffers,
  type ImplicitWorkerRequest,
  type ImplicitWorkerReply,
} from "@/lib/implicit-surface"

/** Same clock the polygoniser uses, so the two are directly comparable. */
function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now()
}

/**
 * THE POLICY DIALS, exported so a probe can drive them and so the PRIOR
 * BEHAVIOUR STAYS REACHABLE. `mode: "sync"` is this module exactly as it was
 * before the worker existed — it is both the parked prior and the negative
 * control every assertion in `scripts/verify/assert-geom-offthread.mjs` is
 * calibrated against. A green row that cannot fail is the lie; `sync` is how
 * these rows are made able to fail.
 */
export const IMPLICIT_DEFER = {
  /** "worker" = defer expensive rebuilds. "sync" = the pre-worker behaviour. */
  mode: "worker" as "worker" | "sync",
  /**
   * A slot must have been MEASURED at least this expensive before any of its
   * rebuilds is deferred. 120 ms is seven frames — below it, a round trip
   * through a worker costs more latency than it saves, and above it the page is
   * dropping frames a human can see. Every synthetic fixture in the
   * verification battery lands far below; the hero word lands at ~600 ms.
   */
  minCostMs: 120,
  /**
   * Finished builds kept keyed by their exact input signature. Dragging a
   * slider back onto a value already visited is then instant instead of another
   * round trip. Three, not thirty: each entry is ~3.5 MB of typed array on the
   * hero word, and unbounded growth over a long session is its own defect.
   */
  cacheEntries: 3,
  /**
   * Hash every adopted build's raw buffers into `IMPLICIT_DEFER_DEBUG.lastHash`.
   *
   * OFF by default because it costs a few ms per build to walk 3.5 MB, and ON
   * is the only way to answer the question this whole change has to answer: is
   * the worker's surface the SAME surface, byte for byte, or merely one that
   * looks like it. `scripts/verify/assert-geom-offthread.mjs` turns it on,
   * builds one input down both paths, and compares — with a different-input arm
   * that must produce a DIFFERENT hash, so the channel is proved able to
   * resolve a change before it is trusted to report the absence of one.
   */
  hash: false,
}

/** Live counters. Read by assertions instead of inferring from pixels. */
export const IMPLICIT_DEFER_DEBUG = {
  /** Builds run synchronously on the main thread. */
  syncBuilds: 0,
  /** Builds handed to the worker. */
  deferredBuilds: 0,
  /** Deferred builds whose result was written into the live geometry. */
  applied: 0,
  /** Requests answered from the signature cache without any build. */
  cacheHits: 0,
  /** Requests superseded before dispatch by a newer one (drag coalescing). */
  coalesced: 0,
  /** Worker construction or runtime failures; each falls back to synchronous. */
  workerErrors: 0,
  /** Is a worker build outstanding right now. */
  pending: false,
  /** ms the worker spent on the last completed build. */
  lastWorkerMs: 0,
  /** ms the main thread last spent inside a synchronous build. */
  lastSyncMs: 0,
  /** Whether a worker was successfully constructed at all. */
  workerReady: false,
  /** Byte hash of the last adopted build. Empty unless `IMPLICIT_DEFER.hash`. */
  lastHash: "",
  /** Which path produced `lastHash`. */
  lastHashSource: "" as "" | "sync" | "worker" | "cache",
  /** Vertex / triangle counts of the last adopted build. */
  lastVertices: 0,
  lastTriangles: 0,
}

/**
 * FNV-1a over every byte of a finished build, plus a second accumulator so the
 * key is 64 bits rather than 32. Two builds that agree here agree on every
 * float of every position, normal, index and reveal key — not on a summary of
 * them. A vertex count and a bounding box would have agreed on a mesh whose
 * every triangle had moved.
 */
function hashBuffers(b: ImplicitBuildBuffers): string {
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b1
  let total = 0
  const feed = (arr: ArrayBufferView | null) => {
    if (!arr) return
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)
    total += bytes.length
    for (let i = 0; i < bytes.length; i++) {
      h1 ^= bytes[i]
      h1 = Math.imul(h1, 0x01000193)
      h2 = (h2 + bytes[i]) | 0
      h2 = Math.imul(h2, 0x85ebca6b)
    }
  }
  feed(b.positions)
  feed(b.normals)
  feed(b.indices)
  feed(b.revealKeys)
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}:${total}`
}

interface CacheEntry {
  /** The exact packed input, kept so a signature hit can be CONFIRMED. */
  capsF: Float64Array
  optsKey: string
  buffers: ImplicitBuildBuffers
}

const SIG_CACHE = new Map<string, CacheEntry>()

/** Two independent FNV-1a passes over the packed doubles — a 64-bit key. */
function signature(capsF: Float64Array, optsKey: string): string {
  const bytes = new Uint8Array(capsF.buffer, capsF.byteOffset, capsF.byteLength)
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < bytes.length; i++) {
    h1 ^= bytes[i]
    h1 = Math.imul(h1, 0x01000193)
    h2 = (h2 + bytes[i]) | 0
    h2 = Math.imul(h2, 0x85ebca6b)
  }
  return `${(h1 >>> 0).toString(36)}.${(h2 >>> 0).toString(36)}.${bytes.length}.${optsKey}`
}

/** Byte-for-byte confirmation, so a hash collision can never show a wrong mesh. */
function sameInput(a: Float64Array, b: Float64Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function copyBuffers(b: ImplicitBuildBuffers): ImplicitBuildBuffers {
  return {
    positions: b.positions ? b.positions.slice() : null,
    normals: b.normals ? b.normals.slice() : null,
    indices: b.indices ? (b.indices.slice() as Uint16Array | Uint32Array) : null,
    revealKeys: b.revealKeys ? b.revealKeys.slice() : null,
    stats: b.stats,
  }
}


export interface ImplicitSlotRequest {
  /**
   * Which on-screen surface this is. Two calls with the same key are the same
   * mark being rebuilt; two calls with different keys are different marks and
   * neither may ever be shown in place of the other.
   */
  slotKey: string
  caps: ImplicitCapsule[]
  opts: ImplicitBuildOptions
  /** radiusZ / radiusXY — applied by `applyImplicitZAspect` on both paths. */
  zAspect: number
  /**
   * Called on the frame a DEFERRED build lands, after the live geometry has
   * been refilled. Never called on the synchronous path (the caller already has
   * the answer). Carries the new `revealKeys`, which the caller must forward
   * onto its `StrokeMeshData` — the draw-in binary-searches that array.
   */
  onSettled?: (result: ImplicitBuildResult) => void
}

export interface ImplicitSlotResult extends ImplicitBuildResult {
  /**
   * TRUE means `geometry` is the surface that was ALREADY on screen and a
   * worker is building the requested one. It is not a failure and it is not a
   * fallback — it is the frame the page keeps instead of freezing.
   */
  deferred: boolean
}

interface Job {
  seq: number
  capsF: Float64Array
  capsI: Int32Array
  optsKey: string
  sig: string
  opts: ImplicitBuildOptions
  zAspect: number
}

interface Slot {
  key: string
  geometry: THREE.BufferGeometry | null
  result: ImplicitBuildResult | null
  lastCostMs: number
  seq: number
  inFlight: Job | null
  queued: Job | null
  onSettled: ((r: ImplicitBuildResult) => void) | null
}

const SLOTS = new Map<string, Slot>()

/**
 * THE REQUEST-ID SPACE IS GLOBAL, AND IT USED NOT TO BE.
 *
 * `job.seq` came from `++slot.seq` — a PER-SLOT counter — while the worker that
 * carries those ids is ONE worker shared by every slot, and `onWorkerReply`
 * resolved a reply by scanning `SLOTS.values()` for the first slot whose
 * in-flight job matched. Two slots each on their first deferred build both
 * carried id 1, so the tie was broken by Map insertion order.
 *
 * MEASURED, not reasoned about (`scripts/verify/_probe-slot-reply-id.mjs`, and
 * gated by `scripts/verify/assert-slot-routing.mjs`): two marks put in flight
 * together, both requests stamped **id 2**; delivering the SECOND mark's reply
 * moved the FIRST mark's live geometry from min.x −0.274 to 3.950 — mark A on
 * screen showing mark B's mesh — fired mark A's `onSettled` with mark B's
 * `revealKeys` (the array the draw-in binary-searches), and left mark B
 * permanently `inFlight`, so its queued rebuild never drained and that slot was
 * WEDGED for the life of the page.
 *
 * That is precisely the invariant `ImplicitSlotRequest.slotKey` states above:
 * *"two calls with different keys are different marks and neither may ever be
 * shown in place of the other."*
 *
 * The fix is two parts, and both are needed. A monotonic MODULE-level counter
 * makes ids unique across slots; `IN_FLIGHT` maps each live id to its own slot,
 * so a reply is routed by lookup rather than by a scan that can match the wrong
 * row. The scan is not merely slow — it is the thing that could be wrong.
 */
let nextRequestSeq = 1
const IN_FLIGHT = new Map<number, Slot>()

/**
 * PARKED PRIOR BEHAVIOUR — `"scan"` restores the per-slot id space and the
 * first-match scan verbatim, and reproduces the recorded defect exactly. It is
 * the NEGATIVE CONTROL for `assert-slot-routing.mjs`, on the same pattern as
 * `SOLID_TUNING.capFit: "source"` (`lib/solid-mask.ts:38`), whose parked arm
 * *"still reproduces the recorded defect exactly"*
 * (docs/explainers/19-the-elbow-and-the-fold.md §9.1). Nothing in app code
 * writes it; a gate whose only evidence is its own green row is the lie.
 */
export const DEFER_ROUTING: { implicit: "byId" | "scan" } = { implicit: "byId" }

function scanForReplyId(id: number): Slot | null {
  for (const s of SLOTS.values()) if (s.inFlight && s.inFlight.seq === id) return s
  return null
}

let worker: Worker | null = null
let workerTried = false

/** The one place a Worker is constructed. Failure is permanent and silent-safe. */
function getWorker(): Worker | null {
  if (worker || workerTried) return worker
  workerTried = true
  if (typeof Worker === "undefined" || typeof window === "undefined") return null
  try {
    worker = new Worker(new URL("./implicit-surface.worker.ts", import.meta.url), {
      type: "module",
    })
    worker.onmessage = (e: MessageEvent<ImplicitWorkerReply>) => onWorkerReply(e.data)
    worker.onerror = () => {
      IMPLICIT_DEFER_DEBUG.workerErrors++
      IMPLICIT_DEFER_DEBUG.workerReady = false
      worker = null
      // Anything outstanding is finished on the main thread rather than lost.
      IN_FLIGHT.clear()
      for (const s of SLOTS.values()) {
        const job = s.queued ?? s.inFlight
        s.inFlight = null
        s.queued = null
        if (job) settleSynchronously(s, job)
      }
      IMPLICIT_DEFER_DEBUG.pending = IN_FLIGHT.size > 0
    }
    IMPLICIT_DEFER_DEBUG.workerReady = true
    return worker
  } catch {
    IMPLICIT_DEFER_DEBUG.workerErrors++
    worker = null
    return null
  }
}

function optsKeyOf(o: ImplicitBuildOptions): string {
  return [
    o.blendK,
    o.cellSize,
    o.runGap ?? 6,
    o.maxCells ?? 12_000_000,
    o.audit !== false ? 1 : 0,
    o.revealOrder ? o.revealOrder.length : -1,
  ].join(",")
}

function cachePut(sig: string, capsF: Float64Array, optsKey: string, b: ImplicitBuildBuffers): void {
  if (IMPLICIT_DEFER.cacheEntries <= 0) return
  SIG_CACHE.delete(sig)
  SIG_CACHE.set(sig, { capsF: capsF.slice(), optsKey, buffers: copyBuffers(b) })
  while (SIG_CACHE.size > IMPLICIT_DEFER.cacheEntries) {
    const oldest = SIG_CACHE.keys().next().value
    if (oldest === undefined) break
    SIG_CACHE.delete(oldest)
  }
}

function cacheGet(sig: string, capsF: Float64Array): ImplicitBuildBuffers | null {
  const hit = SIG_CACHE.get(sig)
  if (!hit) return null
  // The hash is 64 bits over up to ~16 KB; a collision would show the WRONG
  // mark, which is not a class of bug worth a probability argument. Confirm.
  if (!sameInput(hit.capsF, capsF)) return null
  // Refresh LRU position.
  SIG_CACHE.delete(sig)
  SIG_CACHE.set(sig, hit)
  return hit.buffers
}

/** Write a finished set of buffers into the slot's LIVE geometry object. */
function adoptBuffers(
  slot: Slot,
  b: ImplicitBuildBuffers,
  zAspect: number,
  source: "sync" | "worker" | "cache",
): ImplicitBuildResult {
  const record = () => {
    IMPLICIT_DEFER_DEBUG.lastHashSource = source
    IMPLICIT_DEFER_DEBUG.lastVertices = b.stats.vertices
    IMPLICIT_DEFER_DEBUG.lastTriangles = b.stats.triangles
    // Hashed AFTER the Z un-scale, so what is compared is the surface that
    // actually renders rather than an intermediate neither path ships.
    IMPLICIT_DEFER_DEBUG.lastHash = IMPLICIT_DEFER.hash ? hashBuffers(b) : ""
  }
  const geo = slot.geometry
  if (!geo || !b.positions || !b.normals || !b.indices) {
    const fresh = implicitBuffersToGeometry(b)
    if (fresh) applyImplicitZAspect(fresh, zAspect)
    slot.geometry = fresh
    slot.result = { geometry: fresh, stats: b.stats, revealKeys: b.revealKeys }
    record()
    return slot.result
  }
  // Free the GPU buffers of the attributes being replaced. `WebGLGeometries`
  // deletes the buffers of the attributes a geometry holds AT DISPOSE TIME, so
  // swapping attributes without this leaks ~3.5 MB of VRAM per rebuild — it
  // walks `geometry.attributes`, and the old ones are no longer in there. The
  // geometry object stays usable: `WebGLGeometries.get` re-registers any
  // geometry whose id it no longer knows, on the next render.
  geo.dispose()
  geo.setAttribute("position", new THREE.BufferAttribute(b.positions, 3))
  geo.setAttribute("normal", new THREE.BufferAttribute(b.normals, 3))
  geo.setIndex(new THREE.BufferAttribute(b.indices, 1))
  applyImplicitZAspect(geo, zAspect)
  slot.result = { geometry: geo, stats: b.stats, revealKeys: b.revealKeys }
  record()
  return slot.result
}

function settleSynchronously(slot: Slot, job: Job): void {
  const t0 = now()
  const b = polygoniseCapsuleFieldBuffers(unpackCapsules({ f: job.capsF, i: job.capsI }), job.opts)
  const cost = now() - t0
  IMPLICIT_DEFER_DEBUG.syncBuilds++
  IMPLICIT_DEFER_DEBUG.lastSyncMs = cost
  slot.lastCostMs = cost
  cachePut(job.sig, job.capsF, job.optsKey, b)
  const r = adoptBuffers(slot, b, job.zAspect, "sync")
  IMPLICIT_DEFER_DEBUG.applied++
  slot.onSettled?.(r)
}

function dispatch(slot: Slot, job: Job): void {
  const w = getWorker()
  if (!w) {
    settleSynchronously(slot, job)
    return
  }
  slot.inFlight = job
  IN_FLIGHT.set(job.seq, slot)
  IMPLICIT_DEFER_DEBUG.pending = true
  IMPLICIT_DEFER_DEBUG.deferredBuilds++
  const revealOrder = job.opts.revealOrder ? job.opts.revealOrder.slice() : null
  const msg: ImplicitWorkerRequest = {
    id: job.seq,
    capsF: job.capsF.slice(),
    capsI: job.capsI.slice(),
    blendK: job.opts.blendK,
    cellSize: job.opts.cellSize,
    runGap: job.opts.runGap ?? 6,
    maxCells: job.opts.maxCells ?? 12_000_000,
    audit: job.opts.audit !== false,
    revealOrder,
  }
  const transfer: ArrayBuffer[] = [msg.capsF.buffer as ArrayBuffer, msg.capsI.buffer as ArrayBuffer]
  if (revealOrder) transfer.push(revealOrder.buffer as ArrayBuffer)
  w.postMessage(msg, transfer)
}

function onWorkerReply(reply: ImplicitWorkerReply): void {
  /* ROUTED BY ID, NOT FOUND BY SEARCH. See the note on `IN_FLIGHT`: the old
   * scan could — and provably did — hand one mark's buffers to another. The
   * `seq` re-check is not redundant: it means a reply for a job this slot has
   * already moved past (a stale reply after a worker error fell back to sync)
   * is dropped rather than adopted over a newer surface. */
  const byScan = DEFER_ROUTING.implicit === "scan"
  const slot = byScan ? scanForReplyId(reply.id) : (IN_FLIGHT.get(reply.id) ?? null)
  IN_FLIGHT.delete(reply.id)
  IMPLICIT_DEFER_DEBUG.pending = IN_FLIGHT.size > 0
  if (!slot || !slot.inFlight || (!byScan && slot.inFlight.seq !== reply.id)) return
  const job = slot.inFlight
  slot.inFlight = null

  if (reply.error) {
    IMPLICIT_DEFER_DEBUG.workerErrors++
    settleSynchronously(slot, job)
  } else {
    const b: ImplicitBuildBuffers = {
      positions: reply.positions,
      normals: reply.normals,
      indices: reply.indices,
      revealKeys: reply.revealKeys,
      stats: reply.stats,
    }
    IMPLICIT_DEFER_DEBUG.lastWorkerMs = reply.stats.msTotal
    // The worker's clock is the same clock: use it to keep `lastCostMs`
    // honest, so a slot that becomes CHEAP (the drawing shrank) goes back to
    // building synchronously instead of paying a round trip forever.
    slot.lastCostMs = reply.stats.msTotal
    cachePut(job.sig, job.capsF, job.optsKey, b)
    const r = adoptBuffers(slot, b, job.zAspect, "worker")
    IMPLICIT_DEFER_DEBUG.applied++
    slot.onSettled?.(r)
  }

  // Drag coalescing: only the NEWEST superseded request survives, so an
  // eight-step slider drag costs at most two builds after the one in flight,
  // not eight.
  const next = slot.queued
  slot.queued = null
  if (next) dispatch(slot, next)
}

/**
 * Build the implicit surface for one on-screen slot, off the main thread when
 * that is both possible and worth it.
 *
 * Returns SYNCHRONOUSLY every time. `deferred: true` means the returned
 * geometry is the one already on screen and the requested one is being built;
 * `onSettled` fires when it lands and the same geometry object now holds it.
 */
export function polygoniseCapsuleFieldForSlot(req: ImplicitSlotRequest): ImplicitSlotResult {
  let slot = SLOTS.get(req.slotKey)
  if (!slot) {
    slot = {
      key: req.slotKey,
      geometry: null,
      result: null,
      lastCostMs: 0,
      seq: 0,
      inFlight: null,
      queued: null,
      onSettled: null,
    }
    SLOTS.set(req.slotKey, slot)
    // One live viewport builds geometry per page (proved by `buildCount`
    // incrementing exactly once per dial change). Bound the map anyway so a
    // caller that varies its key can never grow it without limit.
    while (SLOTS.size > 8) {
      const oldest = SLOTS.keys().next().value
      if (oldest === undefined || oldest === req.slotKey) break
      SLOTS.delete(oldest)
    }
  }
  slot.onSettled = req.onSettled ?? null

  const packed = packCapsules(req.caps)
  const optsKey = optsKeyOf(req.opts)
  const sig = signature(packed.f, optsKey)
  /* `slot.seq` counts this slot's own build requests and is what the old code
   * wrongly reused as the worker request id. It is kept, and kept ticking,
   * because "how many rebuilds has this mark asked for" is a real number; it is
   * simply no longer the thing the worker is told. */
  slot.seq++
  const job: Job = {
    /* GLOBAL, not `++slot.seq` — see the `IN_FLIGHT` note. `"scan"` restores
     * the per-slot id space for the negative control. */
    seq: DEFER_ROUTING.implicit === "scan" ? slot.seq : nextRequestSeq++,
    capsF: packed.f,
    capsI: packed.i,
    optsKey,
    sig,
    opts: req.opts,
    zAspect: req.zAspect,
  }

  // 1. Already built this exact input — no thread, no worker, no wait.
  const cached = cacheGet(sig, packed.f)
  if (cached) {
    IMPLICIT_DEFER_DEBUG.cacheHits++
    const r = adoptBuffers(slot, copyBuffers(cached), req.zAspect, "cache")
    return { ...r, deferred: false }
  }

  // 2. Nothing on screen to hold, a build never yet measured expensive, or no
  //    worker: build it here and now, exactly as this module always did.
  const eligible =
    IMPLICIT_DEFER.mode === "worker" &&
    slot.geometry !== null &&
    slot.lastCostMs >= IMPLICIT_DEFER.minCostMs
  if (!eligible) {
    settleSynchronously(slot, job)
    return { ...(slot.result as ImplicitBuildResult), deferred: false }
  }

  // 3. Defer. Hand back the surface already on screen.
  if (slot.inFlight) {
    if (slot.queued) IMPLICIT_DEFER_DEBUG.coalesced++
    slot.queued = job
  } else {
    dispatch(slot, job)
  }
  return { ...(slot.result as ImplicitBuildResult), deferred: true }
}

/**
 * Resolve when no slot has a build outstanding. For harnesses: a probe that
 * reads geometry after a dial change must be able to WAIT for the answer
 * instead of racing it.
 */
export function implicitBuildsIdle(timeoutMs = 20000): Promise<boolean> {
  const t0 = now()
  return new Promise((resolve) => {
    const check = () => {
      let busy = false
      for (const s of SLOTS.values()) if (s.inFlight || s.queued) busy = true
      if (!busy) return resolve(true)
      if (now() - t0 > timeoutMs) return resolve(false)
      setTimeout(check, 16)
    }
    check()
  })
}

/** Drop every cached build and slot. Used by probes between arms. */
export function resetImplicitDeferState(): void {
  SIG_CACHE.clear()
  SLOTS.clear()
  IN_FLIGHT.clear()
  IMPLICIT_DEFER_DEBUG.pending = false
}

/**
 * PUBLISH THE SWITCH AND THE COUNTERS TO THE PAGE.
 *
 * Deliberately from this module and not from a component. The change this file
 * makes is invisible to React by design — the swap happens on a
 * `THREE.BufferGeometry` between frames — so a harness cannot observe it
 * through any existing hook, and "the page felt fast" is not a measurement of
 * whether the deferral engaged. `window.__implicitDefer` is the only channel
 * that can say WHICH PATH built the surface, and it is what makes the parked
 * prior (`law.mode = "sync"`) drivable as a negative control rather than a
 * comment claiming one exists.
 *
 * `globalThis` is guarded rather than `window` so this is inert under node and
 * under SSR; the object is attached once, on module evaluation, and holds live
 * references, so a probe reads current values rather than a snapshot.
 */
if (typeof globalThis !== "undefined" && typeof (globalThis as Record<string, unknown>).window !== "undefined") {
  ;(globalThis as unknown as Record<string, unknown>).__implicitDefer = {
    law: IMPLICIT_DEFER,
    debug: IMPLICIT_DEFER_DEBUG,
    idle: implicitBuildsIdle,
    reset: resetImplicitDeferState,
  }
}

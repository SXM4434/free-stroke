/**
 * THE DEFERRED PEN-FIELD BAKE — the scheduler, the cache and the worker.
 *
 * ── THE DEFECT THIS FILE EXISTS FOR ───────────────────────────────────────
 * Explainer 20 took the implicit GEOMETRY build off the main thread and the
 * dial freeze went 859–942 ms to 250–259 ms. Its §10 then names, in a profile
 * of the same gesture taken AFTER that change, exactly what is left:
 *
 *     105.6 ms  `buildPenField`    lib/flat-ink.ts   (no line: a sibling lane is
 *                                   editing that file and it moved twice today)
 *      61.3 ms  nibHalfWidth       lib/flat-ink.ts   (inside it)
 *      29.4 ms  penTaperProfile    lib/flat-ink.ts   (inside it)
 *      17.4 ms  findHeroJunctions  app/desk-doodles/page.tsx
 *
 * — and says why it is the same defect one module over: *"a rasterisation on
 * the render thread"*, whose output is a `Float32Array` that already goes to
 * the GPU through a `DataTexture` held in a ref that survives re-renders. All
 * three preconditions the geometry fix needed are already true here.
 *
 * ── THE THREE THINGS COPIED FROM THAT LANE, DELIBERATELY ──────────────────
 * 1 · **The swap does not go through React**, because it cannot. `syncPenField`
 *     is called from R3F's frame loop and must return synchronously; React will
 *     not re-render when a worker finishes because nothing changed that React
 *     can see. So the deferred call hands back the field ALREADY ON SCREEN and
 *     `onSettled` refills that same object — and its `DataTexture` — in place.
 *     three reads the texture every frame, so the new outline arrives on the
 *     next rendered frame. The mark never blanks; it holds its last good carve
 *     and then changes.
 * 2 · **The worker never re-implements the bake.** `runPenFieldWorkerRequest`
 *     (lib/flat-ink.ts §PF-W) calls `buildPenField`, the same function the
 *     synchronous path calls. One implementation, two threads.
 * 3 · **Nothing that reads the field immediately may read a stale one**, so the
 *     first bake of a slot never defers, a bake never measured expensive never
 *     defers, and the caller refuses to defer at all while an exporter owns the
 *     frame loop (`components/viewport-3d.tsx`).
 *
 * ⚠ AND WHY THIS IS A SEPARATE FILE FROM `lib/flat-ink.ts`. The worker imports
 * that module. If the `new Worker(new URL(...))` expression also lived there,
 * the module graph would contain a cycle through a worker entry and TURBOPACK
 * DEADLOCKS ON IT — `Ready in 186ms`, then `Compiling / ...` forever, every
 * tokio worker parked in `_pthread_cond_wait` at 0 % CPU, no error printed
 * anywhere, and `tsc --noEmit` green the whole time. Bisected in both
 * directions on 2026-08-01; explainer 20 §8. **`lib/flat-ink.ts` may never
 * import this file, and may never name the worker URL.**
 */
import {
  buildPenField,
  packPenStrokes,
  unpackPenStrokes,
  PEN_NIB_DEFAULT,
  PEN_FIELD_UNITS_PER_TEXEL,
  type FlatPoint,
  type PenField,
  type PenNib,
  type PenFieldWorkerRequest,
  type PenFieldWorkerReply,
} from "@/lib/flat-ink"

/** Same clock the bake uses, so the two numbers are directly comparable. */
function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now()
}

/**
 * THE POLICY DIALS, exported so a probe can drive them and so THE PRIOR
 * BEHAVIOUR STAYS REACHABLE. `mode: "sync"` is this module exactly as the app
 * behaved before the worker existed — it is both the parked prior and the
 * negative control every row in `scripts/verify/assert-penfield-offthread.mjs`
 * and `_probe-penfield-latency.mjs` is calibrated against. A green row that
 * cannot fail is the lie; `sync` is what makes these rows able to fail.
 */
export const PEN_FIELD_DEFER = {
  /** "worker" = defer expensive re-bakes. "sync" = the pre-worker behaviour. */
  mode: "worker" as "worker" | "sync",
  /**
   * A slot must have been MEASURED at least this expensive before any of its
   * re-bakes is deferred.
   *
   * 40 ms, not the geometry lane's 120. The two numbers answer the same
   * question — "is a round trip cheaper than doing it here?" — against very
   * different costs. This bake is measured at 55–75 ms on the hero word
   * (`__heroPenField.bakeMs`), so a 120 ms floor would never be crossed and the
   * fix would be inert; 40 ms is still two and a half frames at 60 Hz, and the
   * round trip itself is small because the request is ~17 KB of packed doubles
   * and the reply is a TRANSFERRED buffer rather than a copied one. Below 40 ms
   * the postMessage latency is a real fraction of the saving.
   *
   * The floor is also what keeps the verification battery on the path it was
   * always on: every synthetic fixture bakes a handful of short strokes in
   * single-digit milliseconds and therefore never defers.
   */
  minCostMs: 40,
  /**
   * Finished bakes kept keyed by their exact input signature. Dragging a slider
   * back onto a value already visited is then instant instead of another round
   * trip. Three, not thirty: the hero word's field is ~3 MB of `Float32Array`,
   * and unbounded growth over a long session is its own defect.
   */
  cacheEntries: 3,
  /**
   * Hash every adopted bake's raw bytes into `PEN_FIELD_DEFER_DEBUG.lastHash`.
   *
   * OFF by default because walking 3 MB costs a few ms per bake, and ON is the
   * only way to answer the question this whole change has to answer: is the
   * worker's field the SAME field, byte for byte, or merely one that looks like
   * it. `assert-penfield-offthread.mjs` turns it on, bakes one input down both
   * paths, compares — and requires a DIFFERENT input to produce a DIFFERENT
   * hash, so the channel is proved able to resolve a change before it is
   * trusted to report the absence of one.
   */
  hash: false,
}

/** Live counters. Read by assertions instead of inferred from pixels. */
export const PEN_FIELD_DEFER_DEBUG = {
  /** Bakes run synchronously on the main thread. */
  syncBuilds: 0,
  /** Bakes handed to the worker. */
  deferredBuilds: 0,
  /** Deferred bakes whose result was written into the live field. */
  applied: 0,
  /** Requests answered from the signature cache without any bake. */
  cacheHits: 0,
  /** Requests superseded before dispatch by a newer one (drag coalescing). */
  coalesced: 0,
  /** Worker construction or runtime failures; each falls back to synchronous. */
  workerErrors: 0,
  /** Is a worker bake outstanding right now. */
  pending: false,
  /** ms the worker spent on the last completed bake. */
  lastWorkerMs: 0,
  /** ms the main thread last spent inside a synchronous bake. */
  lastSyncMs: 0,
  /** Whether a worker was successfully constructed at all. */
  workerReady: false,
  /** Byte hash of the last adopted field. Empty unless `PEN_FIELD_DEFER.hash`. */
  lastHash: "",
  /** Which path produced `lastHash`. */
  lastHashSource: "" as "" | "sync" | "worker" | "cache",
  /** Texel dimensions of the last adopted field. */
  lastWidth: 0,
  lastHeight: 0,
}

/**
 * FNV-1a over every byte of the baked field, plus a second accumulator so the
 * key is 64 bits rather than 32. Two bakes that agree here agree on every float
 * of every texel of both channels — not on a summary of them. A width, a height
 * and a bounding box would have agreed on a field whose every texel had moved.
 */
function hashField(f: PenField): string {
  const bytes = new Uint8Array(f.data.buffer, f.data.byteOffset, f.data.byteLength)
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b1
  for (let i = 0; i < bytes.length; i++) {
    h1 ^= bytes[i]
    h1 = Math.imul(h1, 0x01000193)
    h2 = (h2 + bytes[i]) | 0
    h2 = Math.imul(h2, 0x85ebca6b)
  }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}:${bytes.length}`
}

interface CacheEntry {
  /** The exact packed input, kept so a signature hit can be CONFIRMED. */
  pts: Float64Array
  optsKey: string
  field: PenField
}

const SIG_CACHE = new Map<string, CacheEntry>()

/** Two independent FNV-1a passes over the packed doubles — a 64-bit key. */
function signature(pts: Float64Array, optsKey: string): string {
  const bytes = new Uint8Array(pts.buffer, pts.byteOffset, pts.byteLength)
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

/** Byte-for-byte confirmation, so a hash collision can never show a wrong field. */
function sameInput(a: Float64Array, b: Float64Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function copyField(f: PenField): PenField {
  return { ...f, data: f.data.slice() }
}

function optsKeyOf(inkDiameter: number, nib: PenNib, unitsPerTexel: number): string {
  return [inkDiameter, nib.aspect, nib.angle, nib.taperRadii, nib.tip ?? -1, unitsPerTexel].join(",")
}

export interface PenFieldSlotRequest {
  /**
   * Which on-screen field this is. Two calls with the same key are the same
   * mark being re-baked; two calls with different keys are different marks and
   * neither may ever be shown in place of the other.
   */
  slotKey: string
  strokes: { points: FlatPoint[] }[]
  inkDiameter: number
  nib?: PenNib
  unitsPerTexel?: number
  /**
   * `false` forces the synchronous path for THIS call, whatever the policy says.
   * The caller uses it for the one condition this module cannot see: an export
   * is stepping the frame loop, and a frame written with a stale carve would be
   * baked into a file. Slow is fine there; wrong is not.
   */
  allowDefer?: boolean
  /**
   * Called on the frame a DEFERRED bake lands. Never called on the synchronous
   * path — the caller already has the answer. The `PenField` handed over is the
   * SAME OBJECT the caller was given before, refilled: `data`, the bounds and
   * the texel dimensions have all changed in place, so the caller's job is to
   * push them at the GPU (`texture.image`, `needsUpdate`) and re-derive its box.
   */
  onSettled?: (field: PenField) => void
}

export interface PenFieldSlotResult {
  /** Never null: the first bake of a slot is always synchronous. */
  field: PenField
  /**
   * TRUE means `field` is the one that was ALREADY on screen and a worker is
   * baking the requested one. It is not a failure and it is not a fallback — it
   * is the frame the page keeps instead of freezing.
   */
  deferred: boolean
}

interface Job {
  seq: number
  pts: Float64Array
  counts: Int32Array
  inkDiameter: number
  nib: PenNib
  unitsPerTexel: number
  optsKey: string
  sig: string
}

interface Slot {
  key: string
  field: PenField | null
  lastCostMs: number
  seq: number
  inFlight: Job | null
  queued: Job | null
  onSettled: ((f: PenField) => void) | null
}

const SLOTS = new Map<string, Slot>()

/**
 * THE REQUEST-ID SPACE IS GLOBAL, AND IT USED NOT TO BE.
 *
 * The identical defect `lib/implicit-defer.ts` carried, in the identical shape,
 * because this scheduler is that one ported: `job.seq` came from `++slot.seq`
 * — a PER-SLOT counter — while the worker carrying those ids is ONE worker
 * shared by every slot, and `onWorkerReply` resolved a reply by scanning
 * `SLOTS.values()` for the first slot whose in-flight job matched. Two slots on
 * their first deferred bake both carry id 1; the tie is broken by Map insertion
 * order. The wrongly-matched slot adopts the other mark's FIELD, and the slot
 * the reply belonged to is left permanently `inFlight` — wedged, its queued
 * bake never draining.
 *
 * It is fixed here at the same time as the other one, for the reason
 * `docs/explainers/16-the-rim-and-the-bead.md` §1 records about the inverted
 * joint predicate: *"Desk Doodles' `detectJointPositions` carries the same
 * inverted predicate — it is a verbatim port of this function, including the
 * bug."* Fixing one copy of a ported defect and leaving the other is how the
 * bug survives the fix.
 *
 * Proved and gated alongside its twin:
 * `scripts/verify/_probe-slot-reply-id.mjs` · `assert-slot-routing.mjs`.
 */
let nextRequestSeq = 1
const IN_FLIGHT = new Map<number, Slot>()

/**
 * PARKED PRIOR BEHAVIOUR — `"scan"` restores the per-slot id space and the
 * first-match scan verbatim. Negative control for `assert-slot-routing.mjs`.
 * Nothing in app code writes it.
 */
export const PEN_DEFER_ROUTING: { mode: "byId" | "scan" } = { mode: "byId" }

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
    worker = new Worker(new URL("./pen-field.worker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (e: MessageEvent<PenFieldWorkerReply>) => onWorkerReply(e.data)
    worker.onerror = () => {
      PEN_FIELD_DEFER_DEBUG.workerErrors++
      PEN_FIELD_DEFER_DEBUG.workerReady = false
      worker = null
      // Anything outstanding is finished on the main thread rather than lost.
      IN_FLIGHT.clear()
      for (const s of SLOTS.values()) {
        const job = s.queued ?? s.inFlight
        s.inFlight = null
        s.queued = null
        if (job) settleSynchronously(s, job)
      }
      PEN_FIELD_DEFER_DEBUG.pending = IN_FLIGHT.size > 0
    }
    PEN_FIELD_DEFER_DEBUG.workerReady = true
    return worker
  } catch {
    PEN_FIELD_DEFER_DEBUG.workerErrors++
    worker = null
    return null
  }
}

function cachePut(sig: string, pts: Float64Array, optsKey: string, f: PenField): void {
  if (PEN_FIELD_DEFER.cacheEntries <= 0) return
  SIG_CACHE.delete(sig)
  SIG_CACHE.set(sig, { pts: pts.slice(), optsKey, field: copyField(f) })
  while (SIG_CACHE.size > PEN_FIELD_DEFER.cacheEntries) {
    const oldest = SIG_CACHE.keys().next().value
    if (oldest === undefined) break
    SIG_CACHE.delete(oldest)
  }
}

function cacheGet(sig: string, pts: Float64Array): PenField | null {
  const hit = SIG_CACHE.get(sig)
  if (!hit) return null
  // The key is 64 bits over ~17 KB; a collision would carve the mark with the
  // WRONG outline, which is not a class of bug worth a probability argument.
  if (!sameInput(hit.pts, pts)) return null
  SIG_CACHE.delete(sig)
  SIG_CACHE.set(sig, hit)
  return hit.field
}

/**
 * Write a finished bake into the slot's LIVE field object.
 *
 * In place, and that is the whole mechanism: the caller is holding this exact
 * object and reading it every frame, so replacing its contents is how the new
 * outline reaches the screen without React ever being told.
 */
function adopt(slot: Slot, next: PenField, source: "sync" | "worker" | "cache"): PenField {
  const live = slot.field
  let out: PenField
  if (!live) {
    slot.field = next
    out = next
  } else {
    live.data = next.data
    live.width = next.width
    live.height = next.height
    live.minX = next.minX
    live.minY = next.minY
    live.maxX = next.maxX
    live.maxY = next.maxY
    live.unitsPerTexel = next.unitsPerTexel
    live.radius = next.radius
    out = live
  }
  PEN_FIELD_DEFER_DEBUG.lastHashSource = source
  PEN_FIELD_DEFER_DEBUG.lastWidth = out.width
  PEN_FIELD_DEFER_DEBUG.lastHeight = out.height
  PEN_FIELD_DEFER_DEBUG.lastHash = PEN_FIELD_DEFER.hash ? hashField(out) : ""
  return out
}

function settleSynchronously(slot: Slot, job: Job): void {
  const t0 = now()
  const f = buildPenField(
    unpackPenStrokes(job.pts, job.counts),
    job.inkDiameter,
    job.nib,
    job.unitsPerTexel,
  )
  const cost = now() - t0
  PEN_FIELD_DEFER_DEBUG.syncBuilds++
  PEN_FIELD_DEFER_DEBUG.lastSyncMs = cost
  slot.lastCostMs = cost
  cachePut(job.sig, job.pts, job.optsKey, f)
  adopt(slot, f, "sync")
  PEN_FIELD_DEFER_DEBUG.applied++
}

function dispatch(slot: Slot, job: Job): void {
  const w = getWorker()
  if (!w) {
    settleSynchronously(slot, job)
    slot.onSettled?.(slot.field as PenField)
    return
  }
  slot.inFlight = job
  IN_FLIGHT.set(job.seq, slot)
  PEN_FIELD_DEFER_DEBUG.pending = true
  PEN_FIELD_DEFER_DEBUG.deferredBuilds++
  const msg: PenFieldWorkerRequest = {
    id: job.seq,
    pts: job.pts.slice(),
    counts: job.counts.slice(),
    inkDiameter: job.inkDiameter,
    nib: job.nib,
    unitsPerTexel: job.unitsPerTexel,
  }
  w.postMessage(msg, [msg.pts.buffer as ArrayBuffer, msg.counts.buffer as ArrayBuffer])
}

function onWorkerReply(reply: PenFieldWorkerReply): void {
  /* ROUTED BY ID, NOT FOUND BY SEARCH — see the note on `IN_FLIGHT`. */
  const byScan = PEN_DEFER_ROUTING.mode === "scan"
  const slot = byScan ? scanForReplyId(reply.id) : (IN_FLIGHT.get(reply.id) ?? null)
  IN_FLIGHT.delete(reply.id)
  PEN_FIELD_DEFER_DEBUG.pending = IN_FLIGHT.size > 0
  if (!slot || !slot.inFlight || (!byScan && slot.inFlight.seq !== reply.id)) return
  const job = slot.inFlight
  slot.inFlight = null

  if (reply.error || !reply.data) {
    PEN_FIELD_DEFER_DEBUG.workerErrors++
    settleSynchronously(slot, job)
  } else {
    const f: PenField = {
      data: reply.data,
      width: reply.width,
      height: reply.height,
      minX: reply.minX,
      minY: reply.minY,
      maxX: reply.maxX,
      maxY: reply.maxY,
      unitsPerTexel: reply.unitsPerTexel,
      radius: reply.radius,
    }
    PEN_FIELD_DEFER_DEBUG.lastWorkerMs = reply.msTotal
    /* The worker's clock is the same clock, so use it to keep `lastCostMs`
     * honest: a slot that becomes CHEAP (the drawing shrank) goes back to
     * baking synchronously instead of paying a round trip forever. */
    slot.lastCostMs = reply.msTotal
    cachePut(job.sig, job.pts, job.optsKey, f)
    adopt(slot, f, "worker")
    PEN_FIELD_DEFER_DEBUG.applied++
  }
  slot.onSettled?.(slot.field as PenField)

  /* Drag coalescing: only the NEWEST superseded request survives, so an
   * eight-step slider drag costs at most two bakes after the one in flight
   * rather than eight. */
  const next = slot.queued
  slot.queued = null
  if (next) dispatch(slot, next)
}

/**
 * Bake the pen field for one on-screen slot, off the main thread when that is
 * both possible and worth it.
 *
 * Returns SYNCHRONOUSLY every time. `deferred: true` means the returned field
 * is the one already on screen and the requested one is being baked;
 * `onSettled` fires when it lands and the same object now holds it.
 */
export function buildPenFieldForSlot(req: PenFieldSlotRequest): PenFieldSlotResult {
  let slot = SLOTS.get(req.slotKey)
  if (!slot) {
    slot = { key: req.slotKey, field: null, lastCostMs: 0, seq: 0, inFlight: null, queued: null, onSettled: null }
    SLOTS.set(req.slotKey, slot)
    // One live viewport bakes one field per page. Bound the map anyway so a
    // caller that varies its key can never grow it without limit.
    while (SLOTS.size > 8) {
      const oldest = SLOTS.keys().next().value
      if (oldest === undefined || oldest === req.slotKey) break
      SLOTS.delete(oldest)
    }
  }
  slot.onSettled = req.onSettled ?? null

  const nib = req.nib ?? PEN_NIB_DEFAULT
  const unitsPerTexel = req.unitsPerTexel ?? PEN_FIELD_UNITS_PER_TEXEL
  const packed = packPenStrokes(req.strokes)
  const optsKey = optsKeyOf(req.inkDiameter, nib, unitsPerTexel)
  const sig = signature(packed.pts, optsKey)
  /* `slot.seq` counts this slot's own bake requests and is kept ticking; it is
   * simply no longer what the worker is told. See the `IN_FLIGHT` note. */
  slot.seq++
  const job: Job = {
    /* GLOBAL, not `++slot.seq`. `"scan"` restores the per-slot id space for the
     * negative control. */
    seq: PEN_DEFER_ROUTING.mode === "scan" ? slot.seq : nextRequestSeq++,
    pts: packed.pts,
    counts: packed.counts,
    inkDiameter: req.inkDiameter,
    nib,
    unitsPerTexel,
    optsKey,
    sig,
  }

  // 1. Already baked this exact input — no thread, no worker, no wait.
  const cached = cacheGet(sig, packed.pts)
  if (cached) {
    PEN_FIELD_DEFER_DEBUG.cacheHits++
    return { field: adopt(slot, copyField(cached), "cache"), deferred: false }
  }

  // 2. Nothing on screen to hold, a bake never yet measured expensive, an
  //    export in progress, or no worker: bake it here and now, exactly as this
  //    module always did.
  const eligible =
    PEN_FIELD_DEFER.mode === "worker" &&
    req.allowDefer !== false &&
    slot.field !== null &&
    slot.lastCostMs >= PEN_FIELD_DEFER.minCostMs
  if (!eligible) {
    settleSynchronously(slot, job)
    return { field: slot.field as PenField, deferred: false }
  }

  // 3. Defer. Hand back the field already on screen.
  if (slot.inFlight) {
    if (slot.queued) PEN_FIELD_DEFER_DEBUG.coalesced++
    slot.queued = job
  } else {
    dispatch(slot, job)
  }
  return { field: slot.field as PenField, deferred: true }
}

/**
 * Resolve when no slot has a bake outstanding. For harnesses: a probe that
 * reads the field after a dial change must be able to WAIT for the answer
 * instead of racing it.
 */
export function penFieldBuildsIdle(timeoutMs = 20000): Promise<boolean> {
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

/** Drop every cached bake and slot. Used by probes between arms. */
export function resetPenFieldDeferState(): void {
  SIG_CACHE.clear()
  SLOTS.clear()
  IN_FLIGHT.clear()
  PEN_FIELD_DEFER_DEBUG.pending = false
}

/**
 * PUBLISH THE SWITCH AND THE COUNTERS TO THE PAGE.
 *
 * Deliberately from this module and not from a component, for the reason the
 * geometry lane already had to write down: the change this file makes is
 * invisible to React by design — the swap happens on a `Float32Array` and a
 * `DataTexture` between frames — so a harness cannot observe it through any
 * existing hook, and "the page felt fast" is not a measurement of whether the
 * deferral engaged. `window.__penFieldDefer` is the only channel that can say
 * WHICH PATH baked the field, and it is what makes the parked prior
 * (`law.mode = "sync"`) drivable as a negative control rather than a comment
 * claiming one exists.
 *
 * `globalThis` is guarded rather than `window` so this is inert under node and
 * under SSR; the object is attached once, on module evaluation, and holds live
 * references, so a probe reads current values rather than a snapshot.
 */
if (typeof globalThis !== "undefined" && typeof (globalThis as Record<string, unknown>).window !== "undefined") {
  ;(globalThis as unknown as Record<string, unknown>).__penFieldDefer = {
    law: PEN_FIELD_DEFER,
    debug: PEN_FIELD_DEFER_DEBUG,
    idle: penFieldBuildsIdle,
    reset: resetPenFieldDeferState,
  }
}

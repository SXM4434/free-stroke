// PROBE — can a worker reply be adopted into the WRONG slot?
//
// WHY THIS EXISTS. Both deferred-build schedulers stamped their request ids from
// a PER-SLOT counter:
//
//     const job: Job = { seq: ++slot.seq, ... }        // per slot
//     w.postMessage({ id: job.seq, ... })              // ONE shared worker
//
// and matched a reply by scanning EVERY slot for the first one whose in-flight
// job carried that id:
//
//     for (const s of SLOTS.values())
//       if (s.inFlight && s.inFlight.seq === reply.id) { slot = s; break }
//
// Those two facts are incompatible. The worker is one worker shared by every
// slot, so the id space must be global; a per-slot counter makes slot A's job 1
// and slot B's job 1 indistinguishable, and `SLOTS.values()` resolves the tie by
// Map insertion order. The reply for one mark is written into the other mark's
// live buffers, its `onSettled` fires with the other mark's `revealKeys` — the
// array the draw-in binary-searches — and the slot the reply actually belonged
// to is left permanently `inFlight`, so its queued rebuild never drains and that
// slot is WEDGED for the life of the page.
//
// Both modules state the invariant this breaks, in their own request types:
// *"two calls with different keys are different marks and neither may ever be
// shown in place of the other."*
//
// BOTH ARMS ARE RUN. `DEFER_ROUTING.implicit = "scan"` and
// `PEN_DEFER_ROUTING.mode = "scan"` restore the prior id space and the prior
// scan verbatim, and must REPRODUCE the defect. A routing fix whose only
// evidence is its own green row is a green row that cannot fail.
//
// HOW IT IS PROVED WITHOUT A BROWSER. Neither scheduler touches the DOM — they
// need only `Worker` and `window` to exist. Both are shimmed with a worker that
// never replies on its own, so replies are hand-delivered in a chosen order and
// the landing site is read directly. No timing, no race, no flake: the
// collision is structural and reproduces deterministically.
import { loadTs } from "./_ts-load.mjs"

/* ---- the shim: a Worker that queues messages and replies only on demand ----
 * No production test hook is added for this. Each module wires `onmessage` onto
 * the instance it constructs, so capturing the instance IS the delivery path —
 * the same one the real worker uses. */
const sent = []
const workers = []
class FakeWorker {
  constructor() {
    this.onmessage = null
    this.onerror = null
    workers.push(this)
  }
  postMessage(msg) {
    sent.push(msg)
  }
  terminate() {}
}
function deliver(reply) {
  const w = workers[workers.length - 1]
  if (!w || typeof w.onmessage !== "function") {
    throw new Error("no worker constructed — the module never reached the deferred path")
  }
  w.onmessage({ data: reply })
}
globalThis.Worker = FakeWorker
if (typeof globalThis.window === "undefined") globalThis.window = globalThis
if (typeof globalThis.self === "undefined") globalThis.self = globalThis

const defer = loadTs("lib/implicit-defer.ts")
const penDefer = loadTs("lib/pen-field-defer.ts")
const surf = loadTs("lib/implicit-surface.ts")
const flat = loadTs("lib/flat-ink.ts")

let fails = 0
const line = (ok, s) => {
  if (!ok) fails++
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${s}`)
}

/* ------------------------------------------------------------------ */
/*  1 · lib/implicit-defer.ts                                         */
/* ------------------------------------------------------------------ */
function runImplicit(routing) {
  const { polygoniseCapsuleFieldForSlot, IMPLICIT_DEFER, DEFER_ROUTING, resetImplicitDeferState } =
    defer
  resetImplicitDeferState()
  DEFER_ROUTING.implicit = routing
  IMPLICIT_DEFER.mode = "worker"
  IMPLICIT_DEFER.minCostMs = 0 // make every rebuild eligible to defer

  // Two DIFFERENT marks, four units apart, so a swapped mesh is unmistakable.
  const capsA = [{ ax: -0.2, ay: 0, az: 0, bx: 0.2, by: 0, bz: 0, ra: 0.08, rb: 0.08, group: 0, order: 0 }]
  const capsB = [{ ax: 4.0, ay: 0, az: 0, bx: 4.9, by: 0, bz: 0, ra: 0.05, rb: 0.05, group: 0, order: 0 }]
  const opts = { blendK: 0, cellSize: 0.05, runGap: 6, audit: false }

  // Prime both slots: the FIRST build of a slot is never deferred (nothing on
  // screen to hold), so this pass is synchronous and leaves each slot with a
  // live geometry object and a measured cost.
  const a0 = polygoniseCapsuleFieldForSlot({ slotKey: "markA", caps: capsA, opts, zAspect: 1 })
  const b0 = polygoniseCapsuleFieldForSlot({ slotKey: "markB", caps: capsB, opts, zAspect: 1 })
  const geoA = a0.geometry
  const geoB = b0.geometry
  const minX = (g) => {
    g.computeBoundingBox()
    return g.boundingBox.min.x
  }
  const primedA = minX(geoA)
  const primedB = minX(geoB)

  sent.length = 0
  let settledA = null
  let settledB = null
  polygoniseCapsuleFieldForSlot({
    slotKey: "markA",
    caps: [{ ...capsA[0], bx: 0.25 }],
    opts,
    zAspect: 1,
    onSettled: (r) => (settledA = r),
  })
  polygoniseCapsuleFieldForSlot({
    slotKey: "markB",
    caps: [{ ...capsB[0], bx: 4.95 }],
    opts,
    zAspect: 1,
    onSettled: (r) => (settledB = r),
  })

  const ids = sent.map((m) => m.id)
  const msgB = sent[1]
  const b = surf.polygoniseCapsuleFieldBuffers(surf.unpackCapsules({ f: msgB.capsF, i: msgB.capsI }), {
    blendK: msgB.blendK,
    cellSize: msgB.cellSize,
    runGap: msgB.runGap,
    maxCells: msgB.maxCells,
    audit: msgB.audit,
    revealOrder: msgB.revealOrder,
  })
  deliver({
    id: msgB.id,
    positions: b.positions,
    normals: b.normals,
    indices: b.indices,
    revealKeys: b.revealKeys,
    stats: b.stats,
  })

  return {
    ids,
    inFlight: sent.length,
    primedA,
    primedB,
    afterA: minX(geoA),
    afterB: minX(geoB),
    settledA: settledA !== null,
    settledB: settledB !== null,
  }
}

/* ------------------------------------------------------------------ */
/*  2 · lib/pen-field-defer.ts — the same scheduler, ported            */
/* ------------------------------------------------------------------ */
function runPenField(routing) {
  const { buildPenFieldForSlot, PEN_FIELD_DEFER, PEN_DEFER_ROUTING, resetPenFieldDeferState } =
    penDefer
  resetPenFieldDeferState()
  PEN_DEFER_ROUTING.mode = routing
  PEN_FIELD_DEFER.mode = "worker"
  PEN_FIELD_DEFER.minCostMs = 0

  const bar = (x0, x1) => [{ points: [{ x: x0, y: 0 }, { x: x1, y: 0 }] }]
  const INK = 6

  sent.length = 0
  const a0 = buildPenFieldForSlot({ slotKey: "penA", strokes: bar(0, 40), inkDiameter: INK })
  const b0 = buildPenFieldForSlot({ slotKey: "penB", strokes: bar(400, 460), inkDiameter: INK })
  const fieldA = a0.field
  const fieldB = b0.field
  const primedA = fieldA.minX
  const primedB = fieldB.minX

  sent.length = 0
  let settledA = null
  let settledB = null
  buildPenFieldForSlot({
    slotKey: "penA",
    strokes: bar(0, 41),
    inkDiameter: INK,
    onSettled: (f) => (settledA = f),
  })
  buildPenFieldForSlot({
    slotKey: "penB",
    strokes: bar(400, 461),
    inkDiameter: INK,
    onSettled: (f) => (settledB = f),
  })

  const ids = sent.map((m) => m.id)
  /* `runPenFieldWorkerRequest` is the worker's OWN entry point — the same call
   * `lib/pen-field.worker.ts` makes — so the reply is built exactly as the real
   * worker builds it. It returns `{ reply, transfer }`, not a bare reply; an
   * earlier draft of this probe passed the wrapper straight through, the id came
   * back `undefined`, and every row went green because NOTHING was delivered.
   * That is the shape of a probe that cannot fail, caught by its own control. */
  const { reply } = flat.runPenFieldWorkerRequest(sent[1])
  deliver(reply)

  return {
    ids,
    inFlight: sent.length,
    primedA,
    primedB,
    afterA: fieldA.minX,
    afterB: fieldB.minX,
    settledA: settledA !== null,
    settledB: settledB !== null,
  }
}

function report(name, r, arm) {
  const collide = r.ids.length === 2 && r.ids[0] === r.ids[1]
  const swapped = Math.abs(r.afterA - r.primedA) > 1e-9
  console.log(
    `  ${arm.padEnd(16)} ids=[${r.ids.join(",")}]${collide ? " ⚠ COLLISION" : ""}` +
      `  A ${r.primedA.toFixed(3)}→${r.afterA.toFixed(3)}${swapped ? "  ⚠ OVERWRITTEN BY B" : ""}` +
      `  settled A=${r.settledA} B=${r.settledB}${!r.settledB ? "  ⚠ B WEDGED" : ""}`,
  )
  return { collide, swapped }
}

for (const [name, run] of [
  ["implicit-defer", runImplicit],
  ["pen-field-defer", runPenField],
]) {
  console.log(`\n=== ${name}: two marks in flight at once ===`)
  const shipped = run(name === "implicit-defer" ? "byId" : "byId")
  const sv = report(name, shipped, "SHIPPED byId")
  const prior = run("scan")
  const pv = report(name, prior, "PRIOR scan")

  line(shipped.inFlight === 2, `${name}: two marks produced ${shipped.inFlight} in-flight request(s)`)
  line(!sv.collide, `${name}: the two requests carry DISTINCT ids`)
  line(!sv.swapped, `${name}: mark A's live buffers were NOT overwritten by mark B's reply`)
  line(!shipped.settledA, `${name}: mark A's onSettled did NOT fire for mark B's reply`)
  line(shipped.settledB, `${name}: mark B's onSettled DID fire for mark B's reply`)

  // THE NEGATIVE CONTROL. The parked arm must still be broken, in all three
  // ways, or these rows prove nothing.
  line(pv.collide, `${name}: PRIOR arm still collides on the id (the control fails)`)
  line(pv.swapped, `${name}: PRIOR arm still adopts B's reply into A (the control fails)`)
  line(!prior.settledB, `${name}: PRIOR arm still leaves mark B wedged (the control fails)`)
}

// Leave the modules on what ships.
defer.DEFER_ROUTING.implicit = "byId"
penDefer.PEN_DEFER_ROUTING.mode = "byId"
defer.resetImplicitDeferState()
penDefer.resetPenFieldDeferState()

console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAIL`}`)
process.exit(fails === 0 ? 0 : 1)

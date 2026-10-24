// Codex crosscheck 2026-09-25, re-run on the fixed tree: a take whose only row is inherited
// (none of its own) must not read as timed. Before the fix `isTimedTake` said true.
import { loadTs } from "./_ts-load.mjs"
const T = await loadTs("lib/stroke-timing.ts")
const strokes = Object.create({ 0: { delayMs: 500, speed: 1, ease: "linear", holdBack: false } })
const own = { strokes: { 0: { delayMs: 500, speed: 1, ease: "linear", holdBack: false } } }
const a = T.isTimedTake({ strokes, ripple: false })
const b = T.isTimedTake(own)
console.log(`inherited-only take reads timed: ${a} (must be false); own-row take: ${b} (must be true)`)
process.exit(!a && b ? 0 : 1)

#!/usr/bin/env node
// Strip Duration positions, evaluated from the shipped xOf expression in Node.
// The flat and early lanes use the same built slots. No browser or gate bar is changed.
// The must-fail replaces only the bar clock conversion in memory and reruns EARLY.
// Covers bar positions and source wiring, not rendered CSS or pointer movement.
import { readFileSync } from "node:fs"
import ts from "typescript"
import { ROOT, loadTs } from "./_ts-load.mjs"

const source = readFileSync(`${ROOT}/components/stroke-strip.tsx`, "utf8")
const K = loadTs("lib/keyframes.ts")
const takeMs = 2000
const slots = [[0, 300], [400, 1100], [1200, takeMs]]
const path = "envelope.durationSeconds"
const lane = (seconds) => ({ [path]: [K.makeKey(0, seconds)] })
const flat = lane(2)
const early = lane(1)
const near = (a, b, ms = 0.001) => Math.abs(a - b) <= ms

function xOfFrom(src, keys) {
  const file = ts.createSourceFile("stroke-strip.tsx", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let expression
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === "xOf") expression = node.initializer?.getText(file)
    ts.forEachChild(node, visit)
  }
  visit(file)
  if (!expression) throw new Error("xOf is missing from the shipped strip")
  const axisMs = takeMs
  const lengthMs = K.keyedLengthMs(takeMs, keys)
  const k = axisMs / lengthMs
  const durationBars = !!keys?.[path]?.length && !keys?.drawProgress?.length
  const unEase = (v) => v
  const clamp01 = (v) => Math.max(0, Math.min(1, v))
  const js = ts.transpileModule(`const xOf = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
  return Function("durationBars", "unEase", "clamp01", "stripTransportMs", "keys", "takeMs", "lengthMs", "axisMs", "ease", "k", `${js}\nreturn xOf`)(
    durationBars, unEase, clamp01, K.stripTransportMs, keys, takeMs, lengthMs, axisMs, "linear", k,
  )
}

const rows = []
function check(name, run) {
  try {
    const detail = run()
    rows.push({ name, ok: detail.ok, detail: detail.text })
  } catch (error) {
    rows.push({ name, ok: false, detail: String(error) })
  }
}

check("FLAT", () => {
  const keyed = xOfFrom(source, flat)
  const unkeyed = xOfFrom(source, undefined)
  const pairs = slots.flat().map((t) => [keyed(t), unkeyed(t)])
  const identical = pairs.filter(([a, b]) => Object.is(a, b)).length
  return { ok: identical === pairs.length, text: `${identical} of ${pairs.length} endpoints exactly match the unkeyed bars` }
})

function earlyRow(src) {
  const xOf = xOfFrom(src, early)
  const landing = K.durationLandingMs(early)
  const axis = K.keyedLengthMs(takeMs, early)
  const ends = slots.map(([, end]) => xOf(end) * axis)
  const endpoints = slots.flat()
  const aligned = endpoints.filter((clock) => near(xOf(clock) * axis, K.stripTransportMs(early, clock, takeMs), 0.001)).length
  return { ok: ends.every((end) => end <= axis + 0.001) && near(ends.at(-1), landing, 1) && aligned === endpoints.length,
    text: `${aligned} of ${endpoints.length} endpoints on the inverse clock, ${ends.length} of ${slots.length} ends <= ${axis.toFixed(3)} ms; last ${ends.at(-1).toFixed(3)} ms, landing ${landing.toFixed(3)} ms` }
}
check("EARLY", () => earlyRow(source))

check("WIRED", () => {
  const needed = ["const a = xOf(t0)", "xOf(t1)", "const ia = xOf(ka)", "const ib = xOf(kb)"]
  const seen = needed.filter((text) => source.includes(text))
  return { ok: seen.length === needed.length, text: `${seen.length} of ${needed.length} bar and ink endpoint calls use xOf` }
})

const old = "? unEase(clamp01(stripTransportMs(keys, ms, takeMs) / lengthMs), ease)"
const mutant = source.replace(old, "? unEase(clamp01(ms / axisMs), ease) * k")
const fired = mutant !== source && !earlyRow(mutant).ok
check("MUST-FAIL", () => ({ ok: fired, text: fired ? "restoring the built-clock position makes EARLY red" : "built-clock bars escaped EARLY" }))

for (const row of rows) console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`)
const passed = rows.filter((row) => row.ok).length
console.log(`${passed} of ${rows.length} strip keyed gate rows pass`)
process.exitCode = passed === rows.length ? 0 : 1

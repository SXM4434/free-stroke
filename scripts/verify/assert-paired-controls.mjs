/**
 * ASSERT: A PAIRED CONTROL IS NOT JUST ITS OWN SUBJECT, NEGATED.
 *
 * WHAT IS AT RISK, and it was found in the wild on 2026-09-04.
 * `assert-export-window`'s Q1 asserted `Math.abs(cs - ci) > 0.15` and paired it
 * with a control reading `Math.abs(cs - ci) <= 0.15`. `paired()` computes
 * `ok = real && !control`, so a control that is the exact complement of the
 * subject makes `!control === real` ALWAYS, and the pair collapses to a bare
 * `if`. It answers the moment the subject answers, with the same fact.
 *
 * ⚠ NO EXISTING CHECK CATCHES THIS. `assert-gate-integrity` holds "does this
 * gate have a control" (channel K) and "does the control still reject its
 * known-bad" (the mutation sweep). A complement control passes BOTH: it exists,
 * and it does flip when the subject flips. It is a control by every structural
 * test and proves nothing.
 *
 * WHY A SEPARATE GATE. The meta-gate refuses to sweep while uncalibrated, so
 * adding a channel there puts every verdict in the repo behind this file's own
 * correctness. This is a read-only source check with no browser and no
 * evidence, so it costs nothing to run and cannot take anything else down.
 */
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, "..", "..")

let pass = 0, fail = 0
const say = (ok, what, detail) => {
  if (ok) { pass++; console.log(`PASS  ${what} — ${detail}`) }
  else { fail++; console.log(`FAIL  ${what} — ${detail}`) }
}

/** The operators that make two predicates complements of each other. */
const FLIP = { ">": "<=", "<=": ">", "<": ">=", ">=": "<", "===": "!==", "!==": "===", "==": "!=", "!=": "==" }

/** Whitespace-insensitive, so formatting cannot hide a complement. */
const norm = (s) => s.replace(/\s+/g, " ").replace(/^\(\)\s*=>\s*/, "").trim().replace(/^\{|\}$/g, "").trim()

/**
 * Split a call's arguments on TOP-LEVEL commas only. A regex split would cut
 * inside `Math.max(a, b)` and inside template strings, and this file exists
 * because a shortcut was taken somewhere else.
 */
function splitArgs(src) {
  const out = []
  let depth = 0, start = 0, q = null
  for (let i = 0; i < src.length; i++) {
    const c = src[i], p = src[i - 1]
    if (q) { if (c === q && p !== "\\") q = null; continue }
    if (c === '"' || c === "'" || c === "`") { q = c; continue }
    if (c === "(" || c === "[" || c === "{") depth++
    else if (c === ")" || c === "]" || c === "}") depth--
    else if (c === "," && depth === 0) { out.push(src.slice(start, i)); start = i + 1 }
  }
  out.push(src.slice(start))
  return out.map((s) => s.trim())
}

/** Every `paired(` call in a file, with its argument list, balanced. */
function pairedCalls(src) {
  const calls = []
  let idx = 0
  while ((idx = src.indexOf("paired(", idx)) !== -1) {
    // skip the definition itself and any word ending in "paired"
    const before = src[idx - 1]
    if (before && /[A-Za-z0-9_$]/.test(before)) { idx += 7; continue }
    let depth = 0, i = idx + 6, q = null, start = idx + 7
    for (; i < src.length; i++) {
      const c = src[i], p = src[i - 1]
      if (q) { if (c === q && p !== "\\") q = null; continue }
      if (c === '"' || c === "'" || c === "`") { q = c; continue }
      if (c === "(") depth++
      else if (c === ")") { depth--; if (depth === 0) break }
    }
    if (depth === 0 && i < src.length) {
      calls.push({ at: src.slice(0, idx).split("\n").length, args: splitArgs(src.slice(start, i)) })
    }
    idx = i + 1
  }
  return calls
}

/** Is `b` `a` with exactly one comparison flipped to its complement? */
function isComplement(a, b) {
  if (!a || !b || a === b) return false
  for (const [op, inv] of Object.entries(FLIP)) {
    if (!a.includes(op)) continue
    // Replace only the FIRST occurrence, so `a > 1 && b > 2` flipping one term
    // is caught, which is the shape that collapses one half of a conjunction.
    if (a.replace(op, inv) === b) return { op, inv }
  }
  // and the plain `!X` / `X` case
  if (b === `!(${a})` || b === `!${a}` || a === `!(${b})` || a === `!${b}`) return { op: "!", inv: "!" }
  return false
}

/* ---- SELF-TEST FIRST, so the predicate is known-answer before it judges ---- */
{
  const good = isComplement("worst < 1e-9", "near(a, b) && Math.abs(x) < 3")
  const badA = isComplement("Math.abs(cs - ci) > 0.15", "Math.abs(cs - ci) <= 0.15")
  const badB = isComplement("cv.peak < 20000", "cv.peak >= 20000")
  const same = isComplement("x > 1", "x > 1")
  say(badA && badA.op === ">" && badA.inv === "<=",
    "CONTROL — the detector CATCHES the real defect it was written for",
    `Math.abs(cs - ci) > 0.15  vs  <= 0.15 → ${badA ? `flagged (${badA.op} → ${badA.inv})` : "MISSED"}`)
  say(!!badB, "CONTROL — it catches the < / >= complement too", `cv.peak < 20000 vs >= 20000 → ${badB ? "flagged" : "MISSED"}`)
  say(!good, "CONTROL — it does NOT flag two genuinely different predicates",
    `"worst < 1e-9" vs "near(a,b) && Math.abs(x) < 3" → ${good ? "FALSELY FLAGGED" : "clean"}`)
  say(!same, "CONTROL — an identical pair is not a complement (it is a different defect)",
    `"x > 1" vs "x > 1" → ${same ? "FALSELY FLAGGED" : "clean"}`)
}

/* ---- THE SWEEP ---- */
const files = readdirSync(join(ROOT, "scripts", "verify"))
  .filter((f) => f.startsWith("assert-") && f.endsWith(".mjs"))
  .filter((f) => f !== "assert-paired-controls.mjs")

let scanned = 0, pairs = 0
const degenerate = []
for (const f of files) {
  const src = readFileSync(join(ROOT, "scripts", "verify", f), "utf8")
  if (!src.includes("paired(")) continue
  scanned++
  for (const c of pairedCalls(src)) {
    if (c.args.length < 4) continue
    pairs++
    const real = norm(c.args[1])
    const ctrl = norm(c.args[3])
    const hit = isComplement(real, ctrl)
    if (hit) degenerate.push(`${f}:${c.at}  (${hit.op} → ${hit.inv})`)
  }
}

say(pairs > 0, "the sweep found paired controls to judge", `${pairs} pair(s) across ${scanned} file(s) of ${files.length} assert-* gates`)
say(degenerate.length === 0,
  "no paired control is merely its own subject with one comparison flipped",
  degenerate.length ? degenerate.join(" · ") : `${pairs} pair(s) checked, none degenerate`)

console.log(`\n${fail === 0 ? `ALL ${pass} PAIRED-CONTROL ASSERTIONS PASS (controls included)` : `${fail} of ${pass + fail} PAIRED-CONTROL ASSERTIONS FAILED`}`)
process.exit(fail === 0 ? 0 : 1)

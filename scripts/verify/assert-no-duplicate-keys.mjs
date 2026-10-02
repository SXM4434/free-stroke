/**
 * ASSERT: NO OBJECT LITERAL DECLARES THE SAME KEY TWICE.
 *
 * WHY THIS IS WORTH A GATE, and it is the cheapest one in the directory.
 * A duplicate key is not an error, not a warning, and invisible to `tsc` and to
 * every linter configured here. The later value simply wins, so **every edit to
 * the first one does nothing, silently, forever.** Somebody tuning the first
 * `sheen` would watch a dial they were moving have no effect, with nothing
 * anywhere saying why.
 *
 * Found in the wild 2026-09-04 by lane E1, in `assert-fusion-authoring`'s own
 * sweep table, while it was fixing something else. Same family as the rest of
 * this directory's findings: not a wrong value, a value that cannot be reached.
 *
 * ⚠ AND THE FIRST SWEEP FOR IT WAS THE DEFECT. A hand-rolled brace scanner
 * reported **322** duplicates, including keys 600 lines apart, because it
 * counted `{` inside regex character classes such as `/[{,]$/` and its stack
 * never popped. The real answer, from a parser, is ZERO. A number that large
 * from an instrument that cheap should have been suspicious on its face.
 */
import ts from "typescript"
import { readFileSync } from "node:fs"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
let pass = 0, fail = 0
const say = (ok, what, detail) => {
  if (ok) { pass++; console.log(`PASS  ${what} — ${detail}`) }
  else { fail++; console.log(`FAIL  ${what} — ${detail}`) }
}

/** Every duplicated key in one source, by the TypeScript parser. */
function dupes(file, src) {
  const out = []
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : file.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS)
  let literals = 0
  const walk = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      literals++
      const seen = new Map()
      for (const pr of n.properties) {
        /* A spread has no key, and a computed key cannot be compared as text —
         * `[a]:` and `[b]:` may or may not collide at run time and this gate
         * does not guess. Both are skipped, and that is a stated blind spot. */
        if (!pr.name || ts.isComputedPropertyName(pr.name)) continue
        const k = pr.name.getText(sf).replace(/^['"`]|['"`]$/g, "")
        const line = sf.getLineAndCharacterOfPosition(pr.getStart(sf)).line + 1
        if (seen.has(k)) out.push(`${file}:${line} \`${k}\` (first at :${seen.get(k)})`)
        else seen.set(k, line)
      }
    }
    ts.forEachChild(n, walk)
  }
  walk(sf)
  return { out, literals }
}

/* ---- KNOWN-ANSWER PAIR FIRST, so the predicate is proven before it sweeps ---- */
{
  const bad = dupes("x.ts", "const a = { sheen: 1, gloss: 2, sheen: 3 }").out
  const good = dupes("x.ts", "const a = { sheen: 1, gloss: 2 }; const b = { sheen: 9 }").out
  const nested = dupes("x.ts", "const a = { m: { k: 1 }, n: { k: 2 } }").out
  const regexy = dupes("x.ts", "const re = /[{,]$/; const a = { k: 1 }; const b = { k: 2 }").out
  say(bad.length === 1 && bad[0].includes("sheen"), "CONTROL — it CATCHES a key declared twice in one literal", `${bad.length} hit: ${bad[0] ?? "none"}`)
  say(good.length === 0, "CONTROL — the same key in two SEPARATE literals is not a duplicate", `${good.length} hits, needs 0`)
  say(nested.length === 0, "CONTROL — the same key in two nested literals is not a duplicate", `${nested.length} hits, needs 0`)
  say(regexy.length === 0, "CONTROL — a `{` inside a regex character class does not confuse it — the exact bug that reported 322",
    `${regexy.length} hits, needs 0`)
}

/* ---- THE SWEEP ---- */
const files = execSync("git ls-files lib app components scripts hooks", { cwd: ROOT, encoding: "utf8" })
  .split("\n").filter((f) => /\.(ts|tsx|mjs|js)$/.test(f))
let scanned = 0, literals = 0
const hits = []
for (const f of files) {
  let src
  try { src = readFileSync(join(ROOT, f), "utf8") } catch { continue }
  scanned++
  const r = dupes(f, src)
  literals += r.literals
  hits.push(...r.out)
}

say(literals > 1000, "the sweep actually reached the codebase", `${scanned} files · ${literals} object literals`)
say(hits.length === 0, "no object literal declares the same key twice",
  hits.length ? hits.slice(0, 12).join(" · ") + (hits.length > 12 ? ` · …and ${hits.length - 12} more` : "") : `${literals} literals checked, 0 duplicates`)

console.log(`\n${fail === 0 ? `ALL ${pass} DUPLICATE-KEY ASSERTIONS PASS (controls included)` : `${fail} of ${pass + fail} DUPLICATE-KEY ASSERTIONS FAILED`}`)
process.exit(fail === 0 ? 0 : 1)

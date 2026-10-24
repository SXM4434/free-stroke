/**
 * ASSERT: NO EM DASH REACHES A STRING A USER READS.
 *
 * WHAT IS AT RISK. It is the single preference he has stated most plainly and
 * most often: *"I hate em dashes."* The global rules spell out the trap in the
 * fix as well as the defect: no em dashes, and **no reaching for parentheses or
 * en dashes instead, since that only trades one tell for another.** End the
 * sentence, or use a comma.
 *
 * WHY IT IS A GATE AND NOT A HABIT. On 2026-09-04 a pass rewrote 84 of these by
 * hand and reported the files clean. It had swept `description:` values only, so
 * 34 `<option>` labels in `style-panel-scaffold.tsx` alone were never looked at.
 * A hand pass reports the files it thought of.
 *
 * WHY IT PARSES NOW (F113 finding 9, Codex 2026-09-18). The first version was two
 * regexes: `key: "..."` for nine key names, and `>text<` for JSX text. Codex put
 * a dash in `{"a — b"}`, in `title="a — b"`, in a template literal and as a
 * `\u2014` escape, one at a time, into an in-memory read of the real tree, and
 * all four rows stayed green across 122 files. Measured the same day with a real
 * parser: 152 non-comment em dashes in the tree the old gate called clean, most
 * of them toasts, tooltips and fusion descriptions. So it now walks the
 * TypeScript AST, which is the proven tool for "what is a string here", and
 * reads the COOKED value of every literal, so an escape is a dash.
 *
 * THE CORPUS, and what is outside it, written here so it cannot drift silently:
 *   IN   every string literal, template literal part and JSX text (entities
 *        `&mdash;` `&#8212;` `&#x2014;` decoded) in .ts/.tsx under lib,
 *        components, app; and `content:` values in their .css files.
 *   OUT  1 · comments. 94 of the first 198 hits were prose about the code.
 *        2 · arguments to `console.*`. They reach devtools, not the page.
 *        3 · comments INSIDE a template literal: GLSL shader source and the
 *            generated module in hero-motion.ts carry `// ...` and `/* ... *\/`
 *            text the page never shows. Only the comment is removed; the rest of
 *            the template is still read, and `://` is not treated as a comment.
 *        4 · a string built at run time (`String.fromCharCode(8212)`), which no
 *            static read can see.
 *
 * THE ALLOWLIST IS TWO SHAPES AND BOTH ARE GLYPHS, NOT PUNCTUATION:
 *   · a literal that is the dash alone, `"—"`, the "no reading yet" placeholder
 *     in a number readout. It is not a sentence anywhere it appears.
 *   · `— Section —` dividers, and ONLY inside a real `{showDebug && ...}` JSX
 *     fence in `viewport-3d.tsx`, whose `showDebug` must still be declared
 *     `debugSurfaceAllowed && debugRequested`. The fence is read from the AST,
 *     not guessed from the filename: Codex showed `<p>— Public sentence —</p>`
 *     outside the fence passing the old filename-and-shape test. If the
 *     declaration changes, the fence proves nothing and nothing is allowed.
 *     `assert-debug-surface-fenced` proves that fence is off in production.
 * Add to this list only with a reason of that kind.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

const EM = "—"
const ROOTS = ["lib", "components", "app"]
const FENCE_FILE = "components/viewport-3d.tsx"
const FENCE_DECL = /const\s+showDebug\s*=\s*debugSurfaceAllowed\s*&&\s*debugRequested\b/
const decode = (t) => t.replace(/&mdash;|&#8212;|&#x2014;/gi, EM)

/** Remove comments of an embedded language from template text, keep the rest. */
const stripEmbeddedComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1")

const isConsoleCall = (n) =>
  ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
  ts.isIdentifier(n.expression.expression) && n.expression.expression.text === "console"

/** Leftmost operand of an `a && b && c` chain. */
const leftmost = (e) => {
  while (ts.isParenthesizedExpression(e)) e = e.expression
  while (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) e = e.left
  return e
}
const isDebugFence = (n) =>
  ts.isJsxExpression(n) && n.expression && ts.isBinaryExpression(n.expression) &&
  n.expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
  ts.isIdentifier(leftmost(n.expression)) && leftmost(n.expression).text === "showDebug"

const DIVIDER = (t) => /^\s*—\s.*\s—\s*$/.test(t)
/* The placeholder is a WHOLE literal that is the dash and nothing else. A
 * template part like `${a} — ${b}` is a separator between two values, and
 * `" — "` with spaces is one too, so neither qualifies. JSX text is trimmed
 * because JSX formatting puts newlines round a lone glyph. (Measured: the first
 * version trimmed everything and let two `${x} — ${y}` titles through.) */
const GLYPH = (t, kind) => (kind === "jsx" ? t.trim() === EM : (kind === "string" || kind === "attr") && t === EM)

export function scanSource(file, src) {
  if (file.endsWith(".css")) {
    const hits = []
    const noComments = src.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    for (const m of noComments.matchAll(/content\s*:\s*([^;}]*)/g)) {
      const v = m[1].replace(/\\2014/gi, EM)
      if (v.includes(EM)) hits.push({ file, line: src.slice(0, m.index).split("\n").length, kind: "css", text: v, allowed: null })
    }
    return hits
  }
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const fenceValid = file === FENCE_FILE && FENCE_DECL.test(src)
  const hits = []
  const visit = (n, inConsole, inFence) => {
    if (isConsoleCall(n)) inConsole = true
    if (fenceValid && isDebugFence(n)) inFence = true
    let text = null, kind = null
    if (ts.isStringLiteral(n)) { text = ts.isJsxAttribute(n.parent) ? decode(n.text) : n.text; kind = ts.isJsxAttribute(n.parent) ? "attr" : "string" }
    else if (ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) { text = stripEmbeddedComments(n.text); kind = "template" }
    else if (ts.isJsxText(n)) { text = decode(n.text); kind = "jsx" }
    if (text !== null && text.includes(EM) && !inConsole) {
      const allowed = GLYPH(text, kind) ? "placeholder glyph" : inFence && DIVIDER(text) ? "debug-fenced section divider" : null
      hits.push({ file, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, kind, text, allowed })
    }
    ts.forEachChild(n, (c) => visit(c, inConsole, inFence))
  }
  visit(sf, false, false)
  return hits
}
const blocking = (hits) => hits.filter((h) => !h.allowed)

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".")) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(tsx?|css)$/.test(p)) acc.push(p)
  }
  return acc
}

let pass = 0, fail = 0
const say = (ok, what, detail) => { ok ? (pass++, console.log(`PASS  ${what}: ${detail}`)) : (fail++, console.log(`FAIL  ${what}: ${detail}`)) }

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  const files = ROOTS.flatMap((r) => walk(r))
  const all = files.flatMap((f) => scanSource(f, readFileSync(f, "utf8")))
  const hits = blocking(all)

  /* The floor catches a WALKER THAT WALKED NOTHING. Measured 2026-09-05: 122
   * .ts/.tsx files. The bar is 100. */
  const tsFiles = files.filter((f) => /\.tsx?$/.test(f)).length
  say(tsFiles >= 100, "the sweep actually reached the tree", `${tsFiles} .ts/.tsx and ${files.length - tsFiles} .css files under ${ROOTS.join(", ")}, floor 100`)
  const fenceSrc = readFileSync(FENCE_FILE, "utf8")
  say(FENCE_DECL.test(fenceSrc), "the debug fence the allowlist trusts is still the one assert-debug-surface-fenced proves",
    `${FENCE_FILE} declares showDebug = debugSurfaceAllowed && debugRequested`)
  say(hits.length === 0, "no em dash in a string a user reads",
    hits.length === 0 ? `0 across ${files.length} files` : `${hits.length} found`)
  for (const h of hits.slice(0, 200)) console.log(`        ${h.file}:${h.line} [${h.kind}] ${h.text.trim().replace(/\s+/g, " ").slice(0, 110)}`)
  const allowedHits = all.filter((h) => h.allowed)
  console.log(`        allowed, ${allowedHits.length}: ` + Object.entries(allowedHits.reduce((a, h) => ((a[h.allowed] = (a[h.allowed] || 0) + 1), a), {})).map(([k, v]) => `${v} ${k}`).join(", "))

  /* POSITIVE CONTROL. Every shape the old gate missed, planted into a synthetic
   * file, must be found, one hit per plant, and the two allowed shapes must not. */
  const CANARY = [
    `const a = { description: "Snappy Draw ${EM} hard off the mark" }`,
    `const b = { label: "Independent ${EM} own clock" }`,
    `export const C = () => <p>Base layer ${EM} part of the surface.</p>`,
    `export const D = () => <span>${EM}</span>`,
    `export const E = () => <p>{"Hello ${EM} world"}</p>`,
    `export const F = () => <button title="Hello ${EM} world">OK</button>`,
    "const g = { label: `Hello " + EM + " world` }",
    `const h = "Hello \\u2014 world"`,
    `export const I = () => <p>Hello &mdash; world</p>`,
    "const j = `${x} built nothing " + EM + " try again`",
    `const k = "not a comment // ${EM} in a string"`,
    "const l = `${a} " + EM + " ${b}`",
    `const m = a + " ${EM} " + b`,
  ].join("\n")
  const planted = blocking(scanSource("components/style-panel-scaffold.tsx", CANARY))
  const plantedLines = planted.map((h) => h.line).join(",")
  say(planted.length === 12 && plantedLines === "1,2,3,5,6,7,8,9,10,11,12,13", "the instrument detects every planted shape and names its line",
    `${planted.length} of 12 found on lines ${plantedLines}; the bare glyph on line 4 allowed`)

  const notCopy = scanSource("components/x.tsx", [
    `const a = { description: "no dash here" }`,
    `// a comment ${EM} is not copy`,
    `console.warn("dev log ${EM} devtools only")`,
    "const glsl = `float x = 1.0; // shader comment " + EM + " not shown\\n/* block " + EM + " */`",
  ].join("\n"))
  say(notCopy.length === 0, "a comment, a console message and a shader comment are not copy", `${notCopy.length} hits on a file whose only dashes are those three`)

  /* THE FENCE IS READ, NOT GUESSED. A divider inside the real fence is allowed;
   * the same divider outside it, or inside a fence whose declaration changed, is not. */
  const decl = "const showDebug = debugSurfaceAllowed && debugRequested\n"
  const inside = blocking(scanSource(FENCE_FILE, decl + `export const X = () => <div>{showDebug && (<div>${EM} Material ${EM}</div>)}</div>`))
  const outside = blocking(scanSource(FENCE_FILE, decl + `export const X = () => <div><p>${EM} Public sentence ${EM}</p></div>`))
  const otherFile = blocking(scanSource("components/other.tsx", decl + `export const X = () => <div>{showDebug && (<div>${EM} Material ${EM}</div>)}</div>`))
  const noDecl = blocking(scanSource(FENCE_FILE, "const showDebug = true\n" + `export const X = () => <div>{showDebug && (<div>${EM} Material ${EM}</div>)}</div>`))
  say(inside.length === 0 && outside.length === 1 && otherFile.length === 1 && noDecl.length === 1,
    "the divider allowance holds only inside the real debug fence",
    `inside ${inside.length} (want 0), outside ${outside.length}, other file ${otherFile.length}, changed declaration ${noDecl.length} (each want 1)`)

  /* THE REAL TREE, ONE REAL DASH. A dash planted into lib/style-system.ts in
   * memory must go red and name the line it was planted on. */
  const ss = readFileSync("lib/style-system.ts", "utf8").split("\n")
  const at = ss.findIndex((l) => /\blabel:\s*"[^"]+"/.test(l))
  const mutated = ss.map((l, i) => (i === at ? l.replace(/(label:\s*")([^"]+)"/, `$1$2 ${EM} planted"`) : l)).join("\n")
  const realPlant = blocking(scanSource("lib/style-system.ts", mutated))
  say(at >= 0 && realPlant.length === 1 && realPlant[0].line === at + 1, "a dash planted in lib/style-system.ts goes red at its line",
    at < 0 ? "no label: line found to plant on" : `${realPlant.length} hit, at line ${realPlant[0]?.line}, planted at ${at + 1}`)

  console.log(fail === 0 ? `\nNO EM DASHES IN USER-FACING COPY: ${pass} rows, ${files.length} files swept` : `\n${fail} FAILED`)
  process.exit(fail === 0 ? 0 : 1)
}

// WANTED: MODEL. This is the comment extractor's own control.
//
// Three traps in one file:
//   1. a `//` inside a STRING — the naive `//.*$` stripper eats the rest of the
//      line and deletes the evidence it was looking for (assert-one-knob.mjs:66).
//   2. a `\/\/` inside a REGEX literal — same shape, different token.
//   3. a line that reads exactly like a battery directive, inside a TEMPLATE
//      LITERAL. A raw-text scan honours it. It is not a comment, so it is not a
//      directive, and this file must come out MODEL with NO directive found.
const HOME = "http://localhost/app"
const PROTO = /^https?:\/\/[a-z]+/
const DOC = `
battery: browser
`
console.log(`PASS  ${HOME} ${PROTO.source} ${DOC.trim().length}`)
process.exit(0)

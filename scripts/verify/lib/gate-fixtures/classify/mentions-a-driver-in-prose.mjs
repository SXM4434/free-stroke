// WANTED: MODEL.
//
// This file names every token the OLD classifier greps for — chromium.launch,
// playwright, puppeteer — and does not drive a browser. It is the shape Lane F
// hit twice on `assert-one-knob.mjs`: the token moved from a fixture string into
// a comment EXPLAINING the rule, and the gate stayed misclassified, because a
// grep cannot tell code from prose.
//
// It also carries them inside string literals, because that was F's first pass:
// a negative-control fixture cannot prove a gate catches a known-bad input
// without containing the known-bad input.
const MUTANT_SOURCE = `import { chromium } from "playwright"\nawait chromium.launch()\n`
const ALSO = "puppeteer.launch({ headless: true })"

console.log(`PASS  this fixture judges a string, not a browser — ${MUTANT_SOURCE.length + ALSO.length} chars`)
process.exit(0)

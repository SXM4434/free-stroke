# Classifier fixtures — the known-answer set for MODEL vs BROWSER

`run-battery.mjs` decides which battery runs a gate. It used to decide by
matching `/chromium\.launch|playwright|puppeteer|\/\/ battery: browser/` against
the file's **raw text**, so a token inside a string, a fixture, or **a comment
explaining the rule** classified the file. Lane F hit it twice on
`assert-one-knob.mjs` and could not fix it by moving the token — only by deleting
it, which left that gate unable to name the three identifiers in its own
documentation.

These fixtures are the calibration for the replacement. Each file's verdict is
fixed by its name, and `node scripts/verify/run-battery.mjs --classify-selftest`
runs the analyser over all of them and exits non-zero unless every one comes out
as named. **An analyser that has never rejected anything is the disease it is
looking for, one level up.**

| fixture | wanted | what it is for |
|---|---|---|
| `mentions-a-driver-in-prose.mjs` | MODEL | every token, in comments and in strings, and no browser anywhere. The old classifier says BROWSER. |
| `launches-a-browser.mjs` | BROWSER | imports a driver and calls `.launch()`. Both classifiers agree — the accept half of the pair. |
| `both-prose-and-launch.mjs` | BROWSER | prose AND a real launch. Prose must never *subtract*. |
| `spawns-a-browser-child.mjs` | BROWSER | launches nothing itself; spawns a child that does. `assert-hero-transition` and `assert-hero-word-legible` are the two real instances. |
| `spawns-a-model-child.mjs` | MODEL | spawns a child that is pure node. Following children must not classify everything that spawns. |
| `directive-says-browser.mjs` | BROWSER, and REQUIRES AN EXEMPTION | a declared directive that CONTRADICTS the structure. Honoured, and failed unless an ALLOW entry says why. |
| `url-and-regex-slashes.mjs` | MODEL | the comment extractor's own control: `//` inside a string, `\/\/` inside a regex, and a line reading `battery: browser` inside a **template literal**. A naive `//.*$` stripper eats the first, and a raw-text scan honours the last. |

`_child-launches.mjs` and `_child-pure.mjs` are the spawn targets, not fixtures
with verdicts of their own.

Nothing here is discovered as a gate: `discover()`'s `SKIP_DIRS` contains
`gate-fixtures`, and no filename starts with `assert-`.

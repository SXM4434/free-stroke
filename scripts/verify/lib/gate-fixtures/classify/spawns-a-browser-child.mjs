// WANTED: BROWSER.
//
// It launches nothing itself. It spawns a child that does — which is exactly
// `assert-hero-transition.mjs:627` (spawns `verify-hero-transition.mjs`) and
// `assert-hero-word-legible.mjs:291` (spawns `_probe-word-ladder.mjs`). The old
// classifier is source-local and cannot see through a child process, which is
// why `assert-hero-transition` had to DECLARE itself and why
// `assert-hero-word-legible` sat in the model battery driving Chrome.
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
const HERE = dirname(fileURLToPath(import.meta.url))

// The literal is inside a call to a LOCAL function that spawns, not inside the
// spawn call itself — the indirection `assert-param-guards.mjs:88` uses.
function run(script) {
  return spawnSync(process.execPath, [join(HERE, script)], { encoding: "utf8" })
}
const r = run("_child-launches.mjs")
console.log(`PASS  child exited ${r.status}`)
process.exit(0)

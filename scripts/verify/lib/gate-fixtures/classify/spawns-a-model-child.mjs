// WANTED: MODEL.
//
// The reject half of the transitive pair. Following children must not classify
// everything that spawns anything — eight model gates shell out to a probe and
// exactly one of them reaches a browser.
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
const HERE = dirname(fileURLToPath(import.meta.url))
const r = spawnSync(process.execPath, [join(HERE, "_child-pure.mjs")], { encoding: "utf8" })
console.log(`PASS  child exited ${r.status}`)
process.exit(0)

// Prints a travel memory run's per-second series: t, renderer.info geometries, live GL buffers
// (createBuffer - deleteBuffer). Usage: node mem-series.mjs <memory-travel-*.json>
import { readFileSync } from "node:fs"
const j = JSON.parse(readFileSync(process.argv[2], "utf8"))
const rows = j.samples.filter((s) => s.label === "travel" && s.info)
console.log(rows.map((s) => `${Math.round(s.t)}:${s.info.r.map((x) => x.geo).join("+")}/${(s.info.gl.createBuffer ?? 0) - (s.info.gl.deleteBuffer ?? 0)}`).join(" "))

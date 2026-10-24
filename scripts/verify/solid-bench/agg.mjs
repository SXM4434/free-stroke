import { readFileSync, readdirSync } from "node:fs"
const dir = process.argv[2]
const f = readdirSync(dir).find((x) => x.endsWith(".cpuprofile"))
const p = JSON.parse(readFileSync(dir + "/" + f, "utf8"))
const byId = new Map(p.nodes.map((n) => [n.id, n]))
const parent = new Map()
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
const dt = new Map()
for (let i = 0; i < p.samples.length; i++) dt.set(p.samples[i], (dt.get(p.samples[i]) ?? 0) + (p.timeDeltas[i] ?? 0))
const self = new Map(), total = new Map()
for (const [id, t] of dt) {
  const n = byId.get(id); const key = n.callFrame.functionName || "(anon)"
  self.set(key, (self.get(key) ?? 0) + t)
  const seen = new Set(); let cur = id
  while (cur !== undefined) { const k = byId.get(cur).callFrame.functionName || "(anon)"; if (!seen.has(k)) { seen.add(k); total.set(k, (total.get(k) ?? 0) + t) } cur = parent.get(cur) }
}
const want = process.argv.slice(3)
const T = total.get("buildPreview") ?? 1
const rows = [...total.entries()].filter(([k]) => want.length ? want.includes(k) : true).sort((a, b) => b[1] - a[1]).slice(0, 40)
for (const [k, t] of rows) console.log(`${(t / 1000).toFixed(0).padStart(7)} ms total  ${((self.get(k) ?? 0) / 1000).toFixed(0).padStart(6)} self  ${(100 * t / T).toFixed(1).padStart(5)}%  ${k}`)

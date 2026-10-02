// PLAN.md section 4: does a cluster get another cluster's override holes?
// Builds the hero word's "Desk" (strokes 0-4) and "Doodles" (5-11) alone and together
// under ANIMATION_GATED overrides, and prints vertex counts and holes used per cluster.
//   node scripts/verify/solid-bench/crossholes.mjs
//
// 2026-09-25: it printed EQUAL or DIFFERENT and exited 0 on either. It now exits 1
// unless every one of these holds (the right outcome, PLAN.md section 4, is that no
// cluster builds another cluster's override holes):
//   X0  the engine publishes the override's cluster owners, and the head cluster has
//       holes of its own, so the check below has something to see (positive control)
//   X1  Doodles alone, given its own holes, uses them (holesUsed > 0)
//   X2  Desk alone, given Doodles' holes, builds exactly its own empty-override mesh
//       and uses 0 holes
//   X3  the whole word with Doodles' holes = Desk own + Doodles own, vertex for vertex
// Must-fail: the owner filter at lib/geometry-engines.ts put back to "every cluster
// gets every hole" through GATE_MUTATE_FILE (see the RUN-QUEUE F118 note for the
// command). That run must exit 1.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
const REPO = fileURLToPath(new URL("../../../", import.meta.url))
const E = await import(REPO + "scripts/verify/lib/engine-node.mjs")
const { loadTs } = await import(REPO + "scripts/verify/_ts-load.mjs")
const eng = loadTs("lib/geometry-engines.ts")
const THREE = await import(REPO + "node_modules/three/build/three.module.js")
const raw = JSON.parse(readFileSync(REPO + "scripts/capture/logo-strokes.json", "utf8"))
const k = (E.CW * 0.9) / raw.width, ox = (E.CW - raw.width * k) / 2, oy = (E.CH - raw.height * k) / 2
const polys = raw.polylines.map((pl) => pl.map((p) => ({ x: ox + p.x * k, y: oy + p.y * k })))
const L = console.log
console.log = () => {}
const strokes = E.process(polys)
const opts = (hs) => ({ canvasWidth: E.CW, canvasHeight: E.CH, solidParams: E.DEFAULT_SOLID_PARAMS, holeStabilization: hs })
const gated = (holes) => ({ mode: "ANIMATION_GATED", activeFinalHolesWorld: holes })
const vec = (list) => list.map((c) => c.map((p) => new THREE.Vector2(p.x, p.y)))
const vc = (m) => m.reduce((s, x) => s + (x.tubeGeometry?.getAttribute("position")?.count ?? 0), 0)
const D = eng.SOLID_DEBUG
// Per cluster, in build order (head first): holes that fed the cap.
const used = () => (D.lastClusterStages ?? [D.lastStages]).map((st) => st?.solidDiagnostics?.stableHolesWorld?.length ?? 0).join(",")
const owners = () => JSON.stringify(D.holeOverrideClusterOwners ?? "(not exposed)")

E.SolidEngine.buildPreview(strokes, opts())
const merged = D.lastStages.solidDiagnostics.stableHolesWorld
const headOnly = (D.lastClusterStages?.[0] ?? D.lastStages).solidDiagnostics.stableHolesWorld
const desk = strokes.slice(0, 5), doodles = strokes.slice(5)
const rows = []
const usedSum = () => used().split(",").reduce((a, x) => a + Number(x), 0)
const row = (name, s, holes) => {
  const v = vc(E.SolidEngine.buildPreview(s, opts(gated(vec(holes)))))
  const u = used()
  rows.push(`${name.padEnd(46)} verts=${String(v).padEnd(6)} holesUsed(per cluster)=${u.padEnd(5)} owners=${owners()}`)
  return { v, u, sum: usedSum(), exposed: Array.isArray(D.holeOverrideClusterOwners) }
}
const deskOwn = row("Desk alone, empty override", desk, [])
const deskForeign = row("Desk alone, Doodles' holes as override", desk, headOnly)
const doodlesOwn = row("Doodles alone, its own holes", doodles, headOnly)
const word = row("whole word, Doodles' holes as override", strokes, headOnly)
row("whole word, every snapshot hole as override", strokes, merged)
console.log = L
L(`static snapshot: ${merged.length} holes across all clusters, ${headOnly.length} in the head cluster`)
L(rows.join("\n"))
const fails = []
const ok = (name, cond, detail) => {
  L(`${cond ? "  PASS" : "  FAIL"}  ${name}: ${detail}`)
  if (!cond) fails.push(name)
}
ok("X0 owners are published and the head cluster has holes to hand out", deskForeign.exposed && headOnly.length > 0, `owners ${owners()}, head holes ${headOnly.length}`)
ok("X1 Doodles alone uses its own holes", doodlesOwn.sum > 0, `holesUsed ${doodlesOwn.u}`)
ok("X2 Desk alone ignores Doodles' holes", deskForeign.v === deskOwn.v && deskForeign.sum === 0, `verts ${deskForeign.v} vs own ${deskOwn.v}, holesUsed ${deskForeign.u}`)
ok("X3 whole word = Desk own + Doodles own", word.v === deskOwn.v + doodlesOwn.v, `${word.v} vs ${deskOwn.v} + ${doodlesOwn.v} = ${deskOwn.v + doodlesOwn.v}`)
L(fails.length ? `FAIL, ${fails.length} of 4: ${fails.join(" · ")}` : "no cluster builds another cluster's holes, 4 of 4")
process.exit(fails.length ? 1 : 0)

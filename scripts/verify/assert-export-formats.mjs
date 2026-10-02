#!/usr/bin/env node
/* ============================================================================
 * assert-export-formats: the three export formats of coverage rows 92, 94 and
 * 96 (`docs/research-2026-09-26/animation-asks-coverage.md`), Node side, in one
 * command. No browser.
 *
 *   node scripts/verify/assert-export-formats.mjs
 *
 * WHAT IT RUNS. The three format gates the 2026-09-30 export-formats lane
 * wrote, each of which builds its file from a fixed frame list (a
 * `planFrames` plan and synthetic source frames, or a synthetic two-stroke
 * export for the GLB), decodes it, and checks frame count, size and the first
 * and last frames against the source, every row paired with its own known-bad:
 *
 *   row 94  assert-export-gif.mjs         GIF: own block walker + ffmpeg
 *   row 96  assert-export-webm-alpha.mjs  WebM with alpha: own EBML walker +
 *                                         ffmpeg's libvpx-vp9 (reads BlockAdditions)
 *   row 92  assert-export-glb-anim.mjs    animated GLB: own GLB reader + three's
 *                                         GLTFLoader and AnimationMixer
 *
 * A ROW here is one gate: it must exit 0 with every row PASS, and with at
 * least as many rows as it had when this file was written (8, 4, 11), so a
 * gate that silently loses rows goes red here.
 *
 * MUST-FAILS. One-line sabotages of the shipped format modules, handed to the
 * child gate through GATE_MUTATE_FILE (`_ts-load.mjs`, and the GLB gate's own
 * loader, apply it; nothing on disk changes). A mutant counts as caught only
 * when the child ran to its summary line AND reported at least one FAIL.
 * Every row must be named by at least one mutant.
 * ========================================================================== */
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ROOT } from "./_ts-load.mjs"

const GATES = [
  { id: "ROW94-GIF", gate: "assert-export-gif", floor: 8, what: "GIF: header and frame count, size, first and last frames vs source, no paper speckle, delays" },
  { id: "ROW96-WEBM-ALPHA", gate: "assert-export-webm-alpha", floor: 4, what: "WebM with alpha: EBML tree with AlphaMode and BlockAdditions, libvpx decode, alpha and ink vs source" },
  { id: "ROW92-GLB-ANIM", gate: "assert-export-glb-anim", floor: 11, what: "animated GLB: parses with its draw-in channels, one keyframe per planned frame, first and last keyframes vs source" },
]

function runGate(gate, env = {}) {
  const r = spawnSync(process.execPath, [join(ROOT, "scripts/verify", `${gate}.mjs`)], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 1 << 28,
    timeout: 900_000,
  })
  const out = `${r.stdout ?? ""}`
  const m = out.match(new RegExp(`${gate}: (\\d+) PASS · (\\d+) FAIL`))
  return {
    status: r.status,
    finished: !!m,
    pass: m ? +m[1] : 0,
    fail: m ? +m[2] : 0,
    tail: `${r.stderr ?? ""}`.trim().split("\n").slice(-1)[0] ?? "",
    failed: out.split("\n").filter((l) => l.startsWith("FAIL")).map((l) => l.slice(0, 140)),
  }
}

/* ---- the rows ------------------------------------------------------------ */
const rows = []
for (const g of GATES) {
  const r = runGate(g.gate)
  const ok = r.status === 0 && r.finished && r.fail === 0 && r.pass >= g.floor
  rows.push({
    id: g.id,
    ok,
    what: g.what,
    detail: r.finished ? `${g.gate}: ${r.pass} PASS · ${r.fail} FAIL (floor ${g.floor} rows), exit ${r.status}` : `did not finish (exit ${r.status}): ${r.tail}`,
  })
}

/* ---- the must-fails ------------------------------------------------------ */
const MUTANTS = [
  {
    /* Not "drop the ground": with no ground the ink-core reservation picks the
     * most frequent exact colour, which is the paper, and it stays exact. The
     * break that matters is a reserved entry that is not the paper. */
    name: "GIF: the reserved paper entry is written one level off",
    gate: "assert-export-gif",
    file: "lib/export/gif.ts",
    find: "    out.push(ground[0], ground[1], ground[2])",
    text: "    out.push(ground[0] - 1, ground[1] - 1, ground[2] - 1)",
    red: "ROW94-GIF",
  },
  {
    name: "GIF: delays rounded gap by gap instead of on the plan's instants",
    gate: "assert-export-gif",
    file: "lib/export/gif.ts",
    find: "    out.push(Math.max(0, b - a))",
    text: "    out.push(Math.max(0, Math.round(((i + 1 < timestampsUs.length ? timestampsUs[i + 1] : endUs) - timestampsUs[i]) / 10000)))",
    red: "ROW94-GIF",
  },
  {
    name: "WebM: AlphaMode is not written on the track",
    gate: "assert-export-webm-alpha",
    file: "lib/export/webm.ts",
    find: "if (alpha) videoParts.push(el(ID.AlphaMode, uint(1)))",
    text: "",
    red: "ROW96-WEBM-ALPHA",
  },
  {
    name: "WebM: the alpha plane goes through limited range (transparent comes back at 16)",
    gate: "assert-export-webm-alpha",
    file: "lib/export/webm-alpha.ts",
    find: "        alpha[y * w + x] = a\n",
    text: "        alpha[y * w + x] = Math.round(16 + (219 * a) / 255)\n",
    red: "ROW96-WEBM-ALPHA",
  },
  {
    name: "GLB: keyframes half a second off the plan's times",
    gate: "assert-export-glb-anim",
    file: "lib/export/drawin-glb.ts",
    find: "(f) => f.timeMs / 1000)",
    text: "(f) => f.timeMs / 1000 + 0.5)",
    red: "ROW92-GLB-ANIM",
  },
  {
    name: "GLB: every frame before a stored state shows the next one instead",
    gate: "assert-export-glb-anim",
    file: "lib/export/drawin-glb.ts",
    find: "if (ja === jb || jf <= ja) put(picked[ia], 1)",
    text: "if (ja === jb || jf <= ja) put(picked[picked.length - 1], 1)",
    red: "ROW92-GLB-ANIM",
  },
]

function editFor(src, file, find, text) {
  const at = src.indexOf(find)
  if (at < 0 || src.indexOf(find, at + 1) >= 0) throw new Error(`mutant text not unique in ${file}: ${JSON.stringify(find)}`)
  return { pos: at, end: at + find.length, text, was: find }
}

const dir = mkdtempSync(join(tmpdir(), "fs-export-formats-mut-"))
const muts = []
for (const m of MUTANTS) {
  let caught = false
  let note = ""
  try {
    const src = readFileSync(join(ROOT, m.file), "utf8")
    const jf = join(dir, "m.json")
    writeFileSync(jf, JSON.stringify({ [m.file]: [editFor(src, m.file, m.find, m.text)] }))
    const r = runGate(m.gate, { GATE_MUTATE_FILE: jf })
    caught = r.finished && r.fail > 0
    note = r.finished
      ? `${m.gate}: ${r.pass} PASS · ${r.fail} FAIL${r.failed.length ? `; first red: ${r.failed[0]}` : ""}`
      : `child did not finish (exit ${r.status}): ${r.tail}`
  } catch (e) {
    note = `mutant could not be built: ${e.message}`
  }
  muts.push({ ...m, caught, note })
}
rmSync(dir, { recursive: true, force: true })

/* ---- report -------------------------------------------------------------- */
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(17)} ${r.what}\n      ${r.detail}`)
console.log("\nMUST-FAILS (each mutant must turn its gate red)")
for (const m of muts) console.log(`${m.caught ? "CAUGHT" : "MISSED"}  ${m.name}  [${m.red}]\n      ${m.note}`)
const pass = rows.filter((r) => r.ok).length
const caught = muts.filter((m) => m.caught).length
const unguarded = rows.filter((r) => !MUTANTS.some((m) => m.red === r.id)).map((r) => r.id)
console.log(`\n${pass} of ${rows.length} rows pass; ${caught} of ${muts.length} mutants caught; rows with no must-fail: ${unguarded.join(", ") || "none"}`)
process.exit(pass === rows.length && caught === muts.length && unguarded.length === 0 ? 0 : 1)

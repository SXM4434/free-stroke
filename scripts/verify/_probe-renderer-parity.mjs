// IS HEADLESS STILL ON THE REAL GPU? — the claim §3 rests on, re-measured.
//
// `docs/DISPATCH.md` §3 permits headless on one measurement from 2026-07-30:
// "121 rAF ticks headless vs 120 headed, identical renderer string". Commit
// `3884dd78` says the opposite: "all verification runs HEADED with Metal, never
// headless". Both cannot be current, and the thing that decides is whether
// `--use-angle=metal` actually takes headless. It matters because the failure is
// invisible: SwiftShader pauses the rAF loop with no error, and a frozen
// animation and a still one are identical in a screenshot.
//
// So this reads the renderer string out of a live WebGL context and counts rAF
// ticks over a fixed window, in both modes, on both surfaces this repo serves.
//
//   FS_PORT=<port> node scripts/verify/_probe-renderer-parity.mjs
import { spawnSync } from "node:child_process"
import { writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "..", "docs", "verification", "harness-2026-08-28")

// the child does the measuring; the parent runs it twice with one variable changed
if (process.env.__RENDERER_CHILD === "1") {
  const { chromium } = await import("./lib/browser.mjs")
  const { LAB_URL, HERO_URL } = await import("./lib/dev-server.mjs")
  const browser = await chromium.launch({})
  const out = []
  for (const [name, url] of [["lab", LAB_URL], ["hero", HERO_URL]]) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
    const t0 = Date.now()
    await page.goto(url, { waitUntil: "networkidle" })
    const gotoMs = Date.now() - t0
    const r = await page.evaluate(async () => {
      const c = document.createElement("canvas")
      const gl = c.getContext("webgl2") || c.getContext("webgl")
      const d = gl && gl.getExtension("WEBGL_debug_renderer_info")
      const renderer = d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl ? gl.getParameter(gl.RENDERER) : "no webgl"
      let ticks = 0
      const start = performance.now()
      await new Promise((res) => {
        const step = () => {
          ticks++
          if (performance.now() - start >= 2000) res()
          else requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      })
      return { renderer, ticks, elapsedMs: Math.round(performance.now() - start) }
    })
    out.push({ surface: name, url, gotoMs, ...r })
    await page.close()
  }
  await browser.close()
  console.log(JSON.stringify(out))
  process.exit(0)
}

const runs = {}
for (const mode of ["headless", "headed"]) {
  const r = spawnSync(process.execPath, [join(__dirname, "_probe-renderer-parity.mjs")], {
    encoding: "utf8",
    cwd: join(__dirname, "..", ".."),
    env: { ...process.env, __RENDERER_CHILD: "1", ...(mode === "headed" ? { FS_HEADED: "1" } : {}) },
    timeout: 300000,
  })
  const line = (r.stdout || "").trim().split("\n").pop()
  try {
    runs[mode] = JSON.parse(line)
  } catch {
    runs[mode] = { error: (r.stdout || "") + (r.stderr || "") }
  }
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, "renderer-parity.json"), JSON.stringify(runs, null, 2) + "\n")

console.log("mode      surface  goto(ms)  rAF/2s  renderer")
for (const mode of ["headless", "headed"]) {
  for (const s of runs[mode] ?? []) {
    console.log(
      `${mode.padEnd(9)} ${s.surface.padEnd(7)} ${String(s.gotoMs).padStart(8)} ${String(s.ticks).padStart(7)}  ${s.renderer}`,
    )
  }
}
for (const surface of ["lab", "hero"]) {
  const a = (runs.headless ?? []).find((x) => x.surface === surface)
  const b = (runs.headed ?? []).find((x) => x.surface === surface)
  if (!a || !b) continue
  console.log(
    `\n${surface}: renderer ${a.renderer === b.renderer ? "IDENTICAL" : "*** DIFFERENT ***"} · ` +
      `rAF ${a.ticks} headless vs ${b.ticks} headed · goto ${a.gotoMs}ms vs ${b.gotoMs}ms`,
  )
}

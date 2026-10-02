#!/usr/bin/env node
/* TEXTURE ANIMATION, EVERY TYPE, ON THE LOGO (TEXTURE-ANIM, 2026-09-26).
 *
 * His words, row 87 of docs/research-2026-09-26/animation-asks-coverage.md: "a lot
 * of teh aniamtions for etxures are hard ro notice are just dont do anythung need
 * more options". This gate grades every Texture Animation type on every pattern,
 * in Rod and Inflate, on the hero logo, in a 1512x982 browser. Nothing is sampled:
 * the type list and the pattern list are parsed out of lib/style-system.ts, so a
 * type added later is graded the day it lands, and a parse that finds nothing
 * fails instead of passing on an empty loop.
 *
 *   MOVES    two real-clock frames 0.5 s apart differ by more changed ink pixels
 *            than BAR, and BAR comes from the null: the same type at speed 0.
 *   OFF      animation unticked, with every type selected, renders byte-identical
 *            to main (base-off.json, captured on e5cc8e73b before any edit).
 *   DIFFERS  every type other than Travel renders a different frame from Travel at
 *            the same fixed clock (speed 0, phase P), at four phases.
 *
 * Must-fails, each shown firing in the row:
 *   MOVES    --mutate=freeze holds the texture clock at the phase with the type
 *            live; every live cell has to fall to the bar. (The first draft had
 *            the null fail a bar built from 3x the null, which cannot go green.)
 *   OFF      --mutate=off-leak keeps the chosen type live while animation is off.
 *   DIFFERS  --mutate=all-travel renders every type as Travel.
 *
 * Modes: --measure (main only: travel strips + the Off baseline), --sheet (the
 * 6-frame strip per type), --only=moves|off|differs, --mutate=<name>.
 */
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs/verification/texture-anim")
mkdirSync(OUT, { recursive: true })
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}`))
const MEASURE = !!arg("measure")
const SHEET = !!arg("sheet")
const ONLY = arg("only")?.split("=")[1] ?? null
const MUTATE = arg("mutate")?.split("=")[1] ?? null
const run = (row) => !MEASURE && !SHEET && (!ONLY || ONLY === row)
const GAP = Number(arg("gap")?.split("=")[1] ?? 500)
const ONLY_TYPES = arg("types")?.split("=")[1]?.split(",") ?? null

/* ── the populations, parsed, never typed in here ─────────────────────────── */
const SRC = readFileSync(join(ROOT, "lib/style-system.ts"), "utf8")
const block = (name) => {
  const m = SRC.match(new RegExp(`export const ${name}[^=]*=\\s*\\[([\\s\\S]*?)\\n\\]`))
  return m ? [...m[1].matchAll(/id:\s*"([a-zA-Z]+)"/g)].map((x) => x[1]) : []
}
const PATTERNS = block("TEXTURE_MODES").filter((id) => id !== "none")
const TYPES = MEASURE ? ["travel"] : block("TEXTURE_ANIMATION_TYPES")
if (PATTERNS.length < 13) throw new Error(`TEXTURE_MODES parsed ${PATTERNS.length} patterns, expected 13+`)
if (!MEASURE && (TYPES.length < 2 || TYPES[0] !== "travel"))
  throw new Error(`TEXTURE_ANIMATION_TYPES parsed [${TYPES}], expected travel first and 2+ types`)
const MODES = arg("modes")?.split("=")[1]?.split(",") ?? ["rod", "inflate"] // --modes=inflate: the strip on one mode
console.log(`population: ${TYPES.length} types [${TYPES}] x ${PATTERNS.length} patterns x ${MODES.length} modes`)

/* ── pixels ──────────────────────────────────────────────────────────────── */
async function decode(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return { w: img.width, h: img.height, d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data, buf }
}
/* A changed pixel: ink in either frame and a channel moved by 12/255 or more.
 * 12 is above the 8-bit dither noise of a lit surface and well under what the
 * eye reads as a change on the dark Rod body (the repo's perceptual floor is a
 * mean of 2, scripts/verify/diff-frames.mjs). */
function changed(a, b) {
  let n = 0, ink = 0
  for (let i = 0; i < a.d.length; i += 4) {
    if (a.d[i + 3] < 20 && b.d[i + 3] < 20) continue
    ink++
    const m = Math.max(Math.abs(a.d[i] - b.d[i]), Math.abs(a.d[i + 1] - b.d[i + 1]), Math.abs(a.d[i + 2] - b.d[i + 2]))
    if (m >= 12) n++
  }
  return { n, ink }
}
const hash = (f) => createHash("sha256").update(f.d).digest("hex").slice(0, 20)

/* ── page ────────────────────────────────────────────────────────────────── */
const polys = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8")).polylines
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 })).newPage()
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
await page.goto(LAB_URL, { waitUntil: "networkidle", timeout: 240000 })
await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness, null, { timeout: 240000 })
if (MUTATE) await page.evaluate((m) => (window.__FS_GATE_MUTATE = m), `texanim-${MUTATE}`)
await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
await page.waitForTimeout(polys.reduce((s, p) => s + p.length, 0) * 12 + polys.length * 60 + 1500)
await page.evaluate(() => {
  window.__revealHarness.setProgress(1)
  window.__captureHarness.enable()
})
const set = (x) => page.evaluate((s) => window.__styleHarness.setStyle(s), x)
const grab = async () => {
  const u = await page.evaluate(() => window.__captureHarness.grab())
  return decode(Buffer.from(u.match(/base64,(.+)/)[1], "base64"))
}
/* Every texture knob a row writes is reset here, at the panel's own default read
 * out of lib/style-system.ts. TEXTURE-ANIM-2: this used to reset the phase and not
 * the speed, so each MOVES null (speed 0) leaked into the live cell after it and
 * all 104 live cells were graded frozen, 0 changed px, Travel included. */
const DEF_SPEED = Number(SRC.match(/^  textureSpeed: ([\d.]+),$/m)?.[1])
if (!(DEF_SPEED > 0)) throw new Error(`textureSpeed default parsed as ${DEF_SPEED}, expected > 0`)
const OFF = {
  textureEnabled: false, textureMode: "none", textureAnimated: false, texturePhase: 0, textureSpeed: DEF_SPEED,
  ditherEnabled: false, ditherAnimated: false, asciiEnabled: false, asciiAnimated: false,
  layerStackEnabled: false, fusionPreset: "none", motionMode: "off", materialAnimationEnabled: false,
}
async function mode(m) {
  await page.evaluate((x) => window.__styleHarness.setMode(x), m)
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.__captureHarness.frontView(1))
  await page.waitForTimeout(500)
}
/* The state a type is graded in: the pattern at the panel's own defaults. */
async function tex(pattern, type, extra = {}) {
  await set(OFF)
  await set({ textureEnabled: true, textureMode: pattern, textureAnimated: true, motionMode: "independent",
    ...(MEASURE ? {} : { textureAnimationType: type }), ...extra })
}
/* Frames on the REAL clock, with the elapsed wall time between grabs recorded. */
async function frames(n, gap = 500) {
  const out = []
  for (let i = 0; i < n; i++) {
    const t = await page.evaluate(() => performance.now())
    out.push({ t, f: await grab() })
    if (i < n - 1) await page.waitForTimeout(Math.max(0, gap - (await page.evaluate(() => performance.now())) + t))
  }
  return out
}
/* Frames closer than a grab round trip: captured inside the page on the
 * animation frame, every `gap` ms of rAF time, with the timestamp of each. */
async function fastFrames(n, gap) {
  const shots = await page.evaluate(async ({ n, gap }) => {
    const out = []
    let last = -1e9
    while (out.length < n) {
      const t = await new Promise((r) => requestAnimationFrame(r))
      if (t - last < gap - 4) continue
      last = t
      out.push({ t, u: window.__captureHarness.grab() })
    }
    return out
  }, { n, gap })
  return Promise.all(shots.map(async (x) => ({ t: x.t, f: await decode(Buffer.from(x.u.match(/base64,(.+)/)[1], "base64")) })))
}
const rows = []
const row = (r) => (rows.push(r), console.log(r.line))
/* Every type is graded at the panel's default speed (1), so a type passes only if
 * its constants make speed 1 plainly visible. The Off rows prove the state stuck:
 * a type the app ignored would render Travel and fail DIFFERS. */

/* ── MEASURE: main, before any edit ──────────────────────────────────────── */
if (MEASURE) {
  const base = {}
  const report = []
  for (const m of MODES) {
    await mode(m)
    for (const p of PATTERNS) {
      await tex(p, "travel", { textureAnimated: false, motionMode: "off" })
      await page.waitForTimeout(500)
      const a = await grab(), b = await grab()
      base[`${m}:${p}`] = hash(a)
      if (hash(a) !== hash(b)) console.log(`FAIL control: two Off grabs differ in-run on ${m}:${p}`)
      await tex(p, "travel")
      await page.waitForTimeout(800)
      const fr = await frames(6)
      const c = fr.slice(1).map((x, i) => changed(fr[i].f, x.f))
      const line = `${m.padEnd(8)}${p.padEnd(12)} ink ${c[0].ink}  changed/0.5s ${c.map((x) => x.n).join(" ")}  (${c.map((x) => ((100 * x.n) / x.ink).toFixed(1) + "%").join(" ")})`
      report.push(line)
      console.log(line)
      if (p === "procedural" || p === "grain") fr.forEach((x, i) => writeFileSync(join(OUT, `measure-${m}-${p}-${i}.png`), x.f.buf))
    }
  }
  writeFileSync(join(OUT, "base-off.json"), JSON.stringify({ commit: "e5cc8e73b", note: "Off frames on main, texture on, animation off", hashes: base }, null, 1))
  writeFileSync(join(OUT, "measure-travel-main.txt"), report.join("\n") + "\n")
}

/* ── MOVES ───────────────────────────────────────────────────────────────── */
/* The null and the live cell go through ONE statistic: four real-clock frames
 * 0.5 s apart give three pairs, and a cell scores the MEDIAN pair, so two of its
 * three half-seconds have to move. TEXTURE-ANIM-2 changed this from the smaller of
 * the first two pairs, after measuring why 8 Pulse cells failed: the texture clock
 * restarts at 0 when the state is set, so every cell grabbed Pulse at T = 0.72 and
 * 1.31, symmetric about its peak at T = 1, and that pair is the same frame by
 * construction (0 px) while the next two pairs changed 60 to 80% of the ink. A
 * periodic type always has two instants that look alike; one pair cannot tell that
 * from stopping. The median still fails a type that moves once and stops (pairs
 * big, 0, 0) and the freeze must-fail. The null used to be one pair, a second
 * statistic against the same bar; it now takes the same four frames. */
const score = (fr) => {
  const c = fr.slice(1).map((x, i) => changed(fr[i].f, x.f))
  const med = [...c.map((x) => x.n)].sort((a, b) => a - b)[1]
  return { n: med, pairs: c.map((x) => x.n), ink: c[0].ink, gaps: fr.slice(1).map((x, i) => Math.round(x.t - fr[i].t)) }
}
if (run("moves")) {
  const nulls = []
  const lives = []
  for (const m of MODES) {
    await mode(m)
    for (const p of PATTERNS) {
      for (const ty of TYPES) {
        await tex(p, ty, { textureSpeed: 0 })
        await page.waitForTimeout(500)
        nulls.push({ m, p, ty, ...score(await frames(4)) })
        await tex(p, ty)
        await page.waitForTimeout(600)
        lives.push({ m, p, ty, ...score(await frames(4)) })
      }
    }
  }
  /* THE BAR, FROM THE NULL. Three times the worst null, and never below 5% of the
   * ink: a type that changes 5% of the logo's ink in half a second is the least a
   * person can be expected to see move, and the null has to sit far under it. */
  const nullMax = Math.max(...nulls.map((x) => x.n))
  const inkMin = Math.min(...lives.map((x) => x.ink))
  const BAR = Math.max(3 * nullMax, Math.round(0.05 * inkMin))
  console.log(`MOVES bar ${BAR} changed px (null max ${nullMax}, 5% of min ink ${inkMin})`)
  const bad = lives.filter((x) => x.n <= BAR)
  /* TRAVEL IS MAIN'S MOTION, UNCHANGED BY THIS WORK, and its tempo is shared by 9 presets, so whether it
   * reads is his call, not this gate's. On Rod Grain it scored 3.8%, 15.5% and 7.3% of the ink on three runs of
   * the same code: the "hard to notice" he named. Its cells are measured and printed as MAIN, never PASS, and
   * leave the graded count; the freeze must-fail still counts every cell, Travel included. */
  const graded = lives.filter((x) => x.ty !== "travel")
  const badGraded = bad.filter((x) => x.ty !== "travel")
  if (MUTATE !== "freeze") for (const x of bad) console.log(`${x.ty === "travel" ? "MAIN" : "FAIL"} moves ${x.m}:${x.p}:${x.ty} changed ${x.n} <= bar ${BAR} (pairs ${x.pairs}, gaps ${x.gaps} ms)${x.ty === "travel" ? "; Travel is main's motion, unchanged, his call" : ""}`)
  for (const ty of TYPES) {
    const l = lives.filter((x) => x.ty === ty)
    const pct = (x) => ((100 * x.n) / x.ink).toFixed(1) + "%"
    const s = [...l].sort((a, b) => a.n - b.n)
    console.log(`  ${ty.padEnd(8)} min ${s[0].n} (${pct(s[0])} ${s[0].m}:${s[0].p})  median ${s[s.length >> 1].n}  over ${l.length} cells; grain rod ${pct(l.find((x) => x.m === "rod" && x.p === "grain"))} inflate ${pct(l.find((x) => x.m === "inflate" && x.p === "grain"))}`)
  }
  const gapsBad = [...nulls, ...lives].filter((x) => x.gaps.some((g) => g < 450 || g > 650)).length
  if (gapsBad) console.log(`FAIL moves clock: ${gapsBad} cells had a frame gap outside 450..650 ms`)
  if (MUTATE === "freeze") {
    const pass = bad.length === lives.length && !gapsBad
    row({ id: "moves-mustfail", pass, line: `${pass ? "PASS" : "FAIL"} MOVES must-fail (freeze): ${bad.length}/${lives.length} live cells fall to the bar ${BAR} with the texture clock held` })
  } else {
    row({ id: "moves", pass: badGraded.length === 0 && !gapsBad, line: `${badGraded.length === 0 && !gapsBad ? "PASS" : "FAIL"} MOVES ${graded.length - badGraded.length}/${graded.length} new-type x pattern x mode cells (Travel's ${lives.length - graded.length} printed, ${bad.length - badGraded.length} under the bar) above bar ${BAR} (null max ${nullMax} over ${nulls.length} speed-0 cells)` })
  }
  writeFileSync(join(OUT, MUTATE ? `moves-mutate-${MUTATE}.json` : "moves.json"), JSON.stringify({ BAR, nullMax, nulls, lives }, null, 1))
}

/* ── OFF ─────────────────────────────────────────────────────────────────── */
if (run("off")) {
  const basePath = join(OUT, "base-off.json")
  if (!existsSync(basePath)) throw new Error("base-off.json is missing: run --measure on main first")
  const base = JSON.parse(readFileSync(basePath, "utf8")).hashes
  let n = 0, ok = 0, ctl = 0
  for (const m of MODES) {
    await mode(m)
    for (const p of PATTERNS) {
      const want = base[`${m}:${p}`]
      if (!want) throw new Error(`base-off.json has no ${m}:${p}`)
      for (const ty of TYPES) {
        await tex(p, ty, { textureAnimated: false, motionMode: "off" })
        await page.waitForTimeout(450)
        const h = hash(await grab())
        n++
        if (h === want) ok++
        else console.log(`FAIL off ${m}:${p}:${ty} ${h} != main ${want}`)
      }
      // Positive control: the baseline hash is reproducible in this run at all.
      await tex(p, "travel", { textureAnimated: false, motionMode: "off" })
      await page.waitForTimeout(450)
      if (hash(await grab()) === want) ctl++
    }
  }
  const label = MUTATE === "off-leak" ? "OFF must-fail (off-leak)" : "OFF"
  const ctlAll = ctl === n / TYPES.length
  const pass = (MUTATE === "off-leak" ? ok < n : ok === n) && ctlAll
  row({ id: "off", pass, line: `${pass ? "PASS" : "FAIL"} ${label}: ${ok}/${n} Off frames byte-identical to main; control ${ctl}/${n / TYPES.length} travel-off frames reproduce main` })
}

/* ── DIFFERS ─────────────────────────────────────────────────────────────── */
if (run("differs")) {
  const PHASES = [0.25, 0.5, 0.75, 1.0]
  let n = 0, ok = 0
  const worst = {}
  for (const m of MODES) {
    await mode(m)
    for (const p of PATTERNS) {
      const ref = []
      for (const ph of PHASES) {
        await tex(p, "travel", { textureSpeed: 0, texturePhase: ph })
        await page.waitForTimeout(350)
        ref.push(await grab())
      }
      for (const ty of TYPES.slice(1)) {
        let sum = 0, ink = 0
        for (let i = 0; i < PHASES.length; i++) {
          await tex(p, ty, { textureSpeed: 0, texturePhase: PHASES[i] })
          await page.waitForTimeout(350)
          const c = changed(ref[i], await grab())
          sum += c.n
          ink = c.ink
        }
        // Differs from Travel by at least 5% of the ink, summed over four phases.
        const bar = Math.round(0.05 * ink)
        n++
        if (sum > bar) ok++
        else if (MUTATE !== "all-travel") console.log(`FAIL differs ${m}:${p}:${ty} changed ${sum} <= ${bar}`)
        worst[ty] = Math.min(worst[ty] ?? Infinity, sum)
      }
    }
  }
  console.log(`  worst per type: ${Object.entries(worst).map(([k, v]) => `${k} ${v}`).join(", ")}`)
  const label = MUTATE === "all-travel" ? "DIFFERS must-fail (all-travel)" : "DIFFERS"
  const pass = MUTATE === "all-travel" ? ok === 0 : ok === n
  row({ id: "differs", pass, line: `${pass ? "PASS" : "FAIL"} ${label}: ${ok}/${n} non-Travel type x pattern x mode cells differ from Travel` })
}

/* ── SHEET: 6 frames per type, 0.5 s apart, one sheet ─────────────────────── */
if (SHEET) {
  const pattern = arg("pattern")?.split("=")[1] ?? "procedural"
  const strips = []
  for (const m of MODES) {
    await mode(m)
    for (const ty of ONLY_TYPES ?? TYPES) {
      await tex(pattern, ty)
      await page.waitForTimeout(800)
      strips.push({ m, ty, fr: GAP < 100 ? await fastFrames(6, GAP) : await frames(6, GAP) })
    }
  }
  /* Consecutive-frame change, per strip: the timing signature. A slide changes a
   * little every frame; a boil holds, then jumps. */
  for (const s of strips) {
    const c = s.fr.slice(1).map((x, i) => changed(s.fr[i].f, x.f))
    console.log(`  ${s.m.padEnd(8)}${s.ty.padEnd(8)} gaps ${s.fr.slice(1).map((x, i) => Math.round(x.t - s.fr[i].t)).join(" ")} ms  changed/frame ${c.map((x) => ((100 * x.n) / x.ink).toFixed(1) + "%").join(" ")}`)
  }
  // Crop to the ink box of the first frame, shared by every cell.
  const f0 = strips[0].fr[0].f
  let x0 = f0.w, y0 = f0.h, x1 = 0, y1 = 0
  for (const s of strips) for (const { f } of s.fr) for (let y = 0; y < f.h; y += 2) for (let x = 0; x < f.w; x += 2) {
    if (f.d[(y * f.w + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  }
  x0 = Math.max(0, x0 - 8); y0 = Math.max(0, y0 - 8); x1 = Math.min(f0.w, x1 + 8); y1 = Math.min(f0.h, y1 + 8)
  x1 = x0 + Math.round((x1 - x0) * 0.46) // "Desk" only, at native scale, so texture is legible
  const cw = x1 - x0, ch = y1 - y0, sc = 1, W = Math.round(cw * sc), H = Math.round(ch * sc)
  const sheet = createCanvas(110 + 6 * (W + 6), 24 + strips.length * (H + 6))
  const g = sheet.getContext("2d")
  g.fillStyle = "#f4f3ef"; g.fillRect(0, 0, sheet.width, sheet.height)
  g.fillStyle = "#222"; g.font = "13px sans-serif"
  for (let i = 0; i < 6; i++) g.fillText(`+${Math.round(strips[0].fr[i].t - strips[0].fr[0].t)} ms`, 110 + i * (W + 6), 16)
  for (let r = 0; r < strips.length; r++) {
    const s = strips[r]
    g.fillText(`${s.m} ${s.ty}`, 6, 24 + r * (H + 6) + H / 2)
    for (let i = 0; i < 6; i++) {
      const img = await loadImage(s.fr[i].f.buf)
      g.drawImage(img, x0, y0, cw, ch, 110 + i * (W + 6), 24 + r * (H + 6), W, H)
    }
  }
  const path = join(OUT, `sheet-${pattern}${GAP === 500 ? "" : `-${GAP}ms`}.png`)
  writeFileSync(path, sheet.toBuffer("image/png"))
  console.log(`sheet ${path} (${strips.length} strips x 6 frames)`)
}

if (errors.length) console.log(`FAIL page errors: ${errors.slice(0, 3).join(" | ")}`)
await browser.close()
const failed = rows.filter((r) => !r.pass).length + (errors.length ? 1 : 0)
console.log(`${failed ? "FAIL" : "PASS"} assert-texture-anim: ${rows.length - rows.filter((r) => !r.pass).length}/${rows.length} rows${MUTATE ? ` (mutate ${MUTATE})` : ""}`)
process.exit(failed ? 1 : 0)

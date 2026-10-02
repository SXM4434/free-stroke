#!/usr/bin/env node
// assert-key-lanes: the key lanes on the page, driven through the page's own
// hooks and through real pointer events. ANIM-3F, F118.
//
//   FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-key-lanes.mjs
//   FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-key-lanes.mjs --nokeys-only --base=ea31c5b38
//   FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-key-lanes.mjs --no-base   # no base file: row 11 FAILS
//
// The second form records row 11's base: the no-keys frame hashes, written to
// docs/verification/keyframes/nokeys-base.json. The first form runs all 16 rows.
//
// ROW 11'S BASE IS READ FROM THE SERVER, NEVER FROM A LABEL (HARDEN-B5, the
// rules HARDEN-B3 wrote into lib/server-commit.mjs). The record form exits 2
// unless --base is ea31c5b38, the server on FS_PORT is clean under app,
// components, lib, hooks and styles, and its HEAD is that commit; it reads the
// server again after the run and writes nothing if the pid, HEAD or cleanliness
// changed. The file stores { base, sha, recordedFrom, at }. The compare form
// exits 2 on a missing base file or one with no 40-hex sha, before it reads the
// server. When the base's sha is the served HEAD, or the served code has no
// difference from it (codeDiffers), row 11 reads SELF: the tree compared to
// itself, never PASS, outside the graded count, named in the summary. SELF rows
// count toward the 16-row total, so graded + SELF === 16, and a SELF row does
// not by itself fail the run.
//
// ROW 11 NEEDS THE SAME WINDOW AND THE SAME CANVAS AS THE BASE (ANIM-3G).
// The window matters on its own: `canvasHeight = innerHeight - 48` sets the
// stroke-to-world scale, `3 / max(canvasWidth, canvasHeight)`, so on main
// itself a 1339 px window against a 982 px one, with the canvas held at 755x890
// in both, is 0 of 5 frames equal. A taller window is therefore no way to match
// the canvas. The docked canvas is smaller by ruling (ANIM-3C), so the no-keys
// frames are grabbed in their own page at the base's window with the dock
// hidden (`lib/dock.mjs`; until L3 a test-only stylesheet, `lib/undock.mjs`,
// floated it over the canvas instead). The canvas is then 755x890 from mount. The base file
// records its window; a branch run at another window FAILS row 11 by name.
//
// READS. `__fsKeys` (the doc), `__fsSetKeys` (returns refusals), `__fsKeySample`
// (clock, sampled values, what the frame loop applied), `__fsTake.get().live`
// (per-mesh drawn counts), the GL frame through `__captureHarness.grab()`, and
// the `data-key*` / `data-curve*` attributes for the UI rows. Row 10 records
// the key state at every frame the real Video export grabs, by wrapping
// `drawImage` while the export runs, then seeks live to each recorded playhead.
//
// DOES NOT READ. Other browsers, the export file's pixels, touch input, the
// elevation and distance lanes' UI (only azimuth, turn, depth and draw are
// driven here), Extrude's clamp note, and three of the four camera moves
// (Settle to front is picked, Turn in the lifts is refused, the other two are
// only listed).
//
// ROWS 12-16 (LANES-UI-3) read every state with the lanes OPEN. Any key opens
// them, the docked dock grows 84 px, the canvas shrinks and the camera fit
// changes, so a closed "no keys" frame against an open "width 1" frame differs
// on layout alone (LANES-UI-2 step 3). Row 12 also runs width 1 in row 11's
// undocked page, where the canvas holds 755x890 whatever the dock does. The
// engine is switched through `__styleHarness.setMode`; the note, the picker and
// its moves are read through `[data-width-clamp]`, `[data-camera-picker]`,
// `[data-camera-move]`, `[data-refused]` and `[data-camera-reason]`.
//
// Every row carries a must-fail: the same check, run on a state that must fail
// it, shown firing. A row whose must-fail passes is reported BLIND and counts
// as a failure.

import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
import { hideDock, openDock } from "./lib/dock.mjs"
import { serverCommit, codeDiffers } from "./lib/server-commit.mjs"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs/verification/keyframes")
const NOKEYS_ONLY = process.argv.includes("--nokeys-only")
// Keep the default for both passes. Row 11 fails when the two windows differ.
const VH =Number((process.argv.find((a) => a.startsWith("--vh=")) ?? "--vh=982").slice(5))
const DIFF = 48
const NOKEY_PS = [0, 0.25, 0.5, 0.75, 1]
const polys = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8")).polylines
mkdirSync(OUT, { recursive: true })

// ── Row 11's base: which commit nokeys-base.json came from ──────────────────
const KEYS_BASE = "ea31c5b38"
const BASE_FILE = join(OUT, "nokeys-base.json")
const refuse = (msg) => {
  console.log(`REFUSED  ${msg}`)
  process.exit(2)
}
const baseArg = (process.argv.find((a) => a.startsWith("--base=")) ?? "").slice(7)
if (NOKEYS_ONLY && !baseArg) refuse(`--nokeys-only needs --base=${KEYS_BASE}, the commit the server runs`)
if (NOKEYS_ONLY && baseArg !== KEYS_BASE) refuse(`--base=${baseArg}: row 11's base is ${KEYS_BASE}`)
// Compare: a missing or unlabelled base is refused before any server is read.
let baseRec = null
// --no-base (CLOUD-LAYOUT): a tree with no row-11 base file to hand runs the other rows; row 11 then
// FAILS as "no nokeys-base.json", by its own rule, and the run cannot exit 0. It never reads as a pass.
const NO_BASE = process.argv.includes("--no-base")
if (NO_BASE && !NOKEYS_ONLY) console.log("NO BASE: --no-base given, row 11 is not compared and FAILS; every other row runs")
if (!NOKEYS_ONLY && !NO_BASE) {
  if (!existsSync(BASE_FILE)) refuse(`${BASE_FILE} is missing; record it with --nokeys-only --base=${KEYS_BASE} against a clean ${KEYS_BASE} server`)
  baseRec = JSON.parse(readFileSync(BASE_FILE, "utf8"))
  if (!(typeof baseRec.sha === "string" && /^[0-9a-f]{40}$/.test(baseRec.sha))) refuse(`${BASE_FILE} has no stored sha (got ${JSON.stringify(baseRec.sha)}); record it again with --nokeys-only --base=${KEYS_BASE}`)
}
const PORT = Number(new URL(LAB_URL).port || 80)
let srv
try {
  srv = serverCommit(PORT)
} catch (e) {
  refuse(e.message)
}
console.log(`server :${PORT} pid ${srv.pid} cwd ${srv.cwd} head ${srv.head}${srv.dirty ? " DIRTY" : " clean"}`)
if (NOKEYS_ONLY) {
  let labelSha
  try {
    labelSha = execFileSync("git", ["-C", srv.top, "rev-parse", "--verify", "--quiet", `${baseArg}^{commit}`], { encoding: "utf8" }).trim()
  } catch {
    refuse(`--base=${baseArg} does not name a commit in the server's repo ${srv.top}`)
  }
  if (srv.dirty) refuse(`the server on :${PORT} (${srv.cwd}) has uncommitted changes under app, components, lib, hooks or styles; a base is recorded from a clean tree only`)
  if (srv.head !== labelSha) refuse(`--base=${baseArg} is ${labelSha}, but the server on :${PORT} (${srv.cwd}) runs ${srv.head}`)
}
// SELF: the base's code is the served code, so row 11 compares the tree to itself.
let self11 = false
if (!NOKEYS_ONLY)
  try {
    self11 = !!baseRec && (baseRec.sha === srv.head || !codeDiffers(srv, baseRec.sha))
  } catch (e) {
    refuse(e.message)
  }

const rows = []
// A SELF row prints SELF, never PASS, and sits outside the pass count.
const row = (id, name, pass, number, mustFail, self = false) => {
  const blind = mustFail && mustFail.fired !== true
  rows.push({ id, name, pass: !self && pass && !blind, self, blind, number, mustFail })
  console.log(`${self ? "SELF" : pass && !blind ? "PASS" : blind ? "BLIND" : "FAIL"} ${id} ${name} | ${number} | must-fail: ${mustFail?.what} -> ${mustFail?.fired ? "fired" : "DID NOT FIRE"} (${mustFail?.number})`)
}

const browser = await chromium.launch()
// One page at a time: row 11's own page first, then the page rows 1-10 drive.
let context = null
let page = null
const ev = (fn, arg) => page.evaluate(fn, arg)
const settle = async (ms = 250) => {
  await page.waitForTimeout(ms)
  await ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}
const setP = async (p) => {
  await ev((x) => window.__revealHarness.setProgress(x), p)
  await settle()
}
const sample = () => ev(() => window.__fsKeySample())
const keys = () => ev(() => JSON.parse(JSON.stringify(window.__fsKeys() ?? {})))
const setKeys = async (k) => {
  const refused = await ev((x) => window.__fsSetKeys(x), k)
  if (refused?.length) throw new Error(`keys refused: ${refused.join("; ")}`)
  await settle(400)
}
/** Grab the GL frame into window.__akF[name]; returns an FNV-1a hash of its bytes. */
const grab = (name) =>
  ev(async (n) => {
    const img = new Image()
    await new Promise((r, j) => ((img.onload = r), (img.onerror = j), (img.src = window.__captureHarness.grab())))
    const cv = document.createElement("canvas")
    cv.width = img.width
    cv.height = img.height
    const g = cv.getContext("2d")
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, img.width, img.height).data
    ;(window.__akF ??= {})[n] = d
    let h = 0x811c9dc5
    for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619) >>> 0
    return `${img.width}x${img.height}:${h.toString(16)}`
  }, name)
/** Pixels whose channels moved by more than DIFF between two stored frames. */
const diffPx = (a, b, t = DIFF) =>
  ev(
    ([a, b, t]) => {
      const A = window.__akF[a],
        B = window.__akF[b]
      let n = 0
      for (let i = 0; i < A.length; i += 4)
        if (Math.abs(A[i] - B[i]) > t || Math.abs(A[i + 1] - B[i + 1]) > t || Math.abs(A[i + 2] - B[i + 2]) > t) n++
      return n
    },
    [a, b, t],
  )
const drawn = () => ev(() => window.__fsTake.get().live.meshes.reduce((s, m) => s + (m.visible ? m.count : 0), 0))
const total = () => ev(() => window.__fsTake.get().live.meshes.reduce((s, m) => s + m.total, 0))
const center = (sel) =>
  ev((s) => {
    const el = document.querySelector(s)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }
  }, sel)
const drag = async (sel, dx, dy) => {
  const c = await center(sel)
  if (!c) throw new Error(`no element ${sel}`)
  await page.mouse.move(c.x, c.y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(c.x + (dx * i) / 8, c.y + (dy * i) / 8)
  await page.mouse.up()
  await settle(300)
}
const clickReal = async (sel) => {
  const c = await center(sel)
  if (!c) throw new Error(`no element ${sel}`)
  await page.mouse.click(c.x, c.y)
  await settle(300)
}
// cubic-bezier(x1,y1,x2,y2) at x, solved independently of lib/keyframes.ts.
const bez = (o, i, x) => {
  const B = (s, a, b) => 3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s
  let lo = 0,
    hi = 1
  for (let k = 0; k < 80; k++) {
    const m = (lo + hi) / 2
    if (B(m, o.x, i.x) < x) lo = m
    else hi = m
  }
  return B((lo + hi) / 2, o.y, i.y)
}

const openLab = async ({ undocked }) => {
  if (context) await context.close()
  context = await browser.newContext({ viewport: { width: 1512, height: VH }, deviceScaleFactor: 1, acceptDownloads: true })
  page = await context.newPage()
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
  // Before the strokes land, so the canvas never takes the docked size first.
  // Since L3 the dock is a group under both panels; hidden, the canvas is
  // dockless main's 755x890 (lib/dock.mjs).
  if (undocked) await hideDock(page)
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness, null, { timeout: 240000 })
  await ev((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  await ev(() => {
    window.__revealHarness.setEase("linear")
    window.__revealHarness.setPlaying(false)
  })
  // The base commit predates the key hooks, so the no-keys pass waits for the page only.
  if (!NOKEYS_ONLY) await page.waitForFunction(() => !!window.__fsTake && !!window.__fsSetKeys, null, { timeout: 60000 })
  // The docked page drives the lanes, which live in the dock's Timeline tab
  // since L3; the dock loads folded, so it is opened here.
  if (!undocked && !NOKEYS_ONLY) await openDock(page)
  await settle(800)
  // Warm: one full sweep so the first measured frame is not a compile frame.
  for (const p of [0, 0.5, 1, 0]) await setP(p)
}
/** The window and the GL canvas's pixel size, recorded beside row 11's frames. */
const sizes = () =>
  ev(() => {
    const c = document.querySelector("canvas[data-engine]")
    return { window: `${innerWidth}x${innerHeight}`, gl: c ? `${c.width}x${c.height}` : null }
  })
const grabNoKeyPs = async (prefix) => {
  const out = {}
  for (const p of NOKEY_PS) {
    await setP(p)
    await settle(300)
    out[p] = await grab(`${prefix}${p}`)
  }
  return out
}

try {
  // ── ROW 11 frames, no keys, in their own page ─────────────────────────────
  // The base has no dock, so its page takes no stylesheet.
  await openLab({ undocked: !NOKEYS_ONLY })
  const nkSizes = await sizes()
  const nokeys = await grabNoKeyPs("nk")
  if (NOKEYS_ONLY) {
    // The server must still be the one checked before the run: same pid, same
    // HEAD, still clean. Otherwise nothing is written.
    let after
    try {
      after = serverCommit(PORT)
    } catch (e) {
      await browser.close()
      refuse(`after the run: ${e.message}`)
    }
    if (after.pid !== srv.pid || after.head !== srv.head || after.dirty) {
      await browser.close()
      refuse(`the server changed during the run: pid ${srv.pid} -> ${after.pid}, head ${srv.head} -> ${after.head}, dirty ${after.dirty}; nothing written`)
    }
    writeFileSync(BASE_FILE, JSON.stringify({ base: baseArg, sha: srv.head, recordedFrom: srv.cwd, at: new Date().toISOString(), url: LAB_URL, ...nkSizes, frames: nokeys }, null, 2))
    console.log(`wrote nokeys-base.json from ${srv.head} (${srv.cwd})`, nkSizes, nokeys)
  } else {
    // Row 11's must-fail, in the SAME page: the only change is one azimuth key.
    const takeLen = (await sample()).takeLen
    // Row 12's undocked half: width keys at 1 and nothing else, same page, same canvas.
    await setKeys({ width: [{ tMs: 0, value: 1, easeOut: "linear", easeIn: "linear" }, { tMs: takeLen, value: 1, easeOut: "linear", easeIn: "linear" }] })
    const uw1 = await grabNoKeyPs("uw1")
    const uw1Sizes = await sizes()
    await setKeys({ azimuth: [{ tMs: 0, value: 0, easeOut: "linear", easeIn: "linear" }, { tMs: takeLen, value: 30, easeOut: "linear", easeIn: "linear" }] })
    const keyed = await grabNoKeyPs("k")

    // ── rows 1-10, in a fresh page with the dock as shipped ───────────────
    await openLab({ undocked: false })
    await ev(() => window.__fsSetKeys(undefined))
    await page.click("[data-key-lanes]")
    await settle(400)
    // The strip names its length once the lanes are open, as measure-dock reads it.
    const L = await ev(() => {
      const s = document.querySelector("[data-stroke-strip]")
      return Number(s?.getAttribute("data-length-ms") ?? s?.getAttribute("data-axis-ms") ?? 0)
    })
    if (!(L > 0)) throw new Error("no data-length-ms on the strip")

    // ── 1 · "+" writes a key at the playhead ────────────────────────────────
    await setP(0.4)
    const s1 = await sample()
    const before1 = (await keys()).azimuth ?? []
    await clickReal("[data-key-add='azimuth']")
    const after1 = (await keys()).azimuth ?? []
    const ok1 = (tr, atMs) => tr.length === 1 && Math.abs(tr[0].tMs - atMs) <= 1
    row(1, '"+" writes a key at the playhead', ok1(after1, s1.clockMs), `playhead ${s1.clockMs.toFixed(1)} ms, key at ${after1[0]?.tMs} ms, ${before1.length}->${after1.length} keys`, {
      what: "same check on the doc before the click, and against a playhead 500 ms away",
      fired: !ok1(before1, s1.clockMs) && !ok1(after1, s1.clockMs + 500),
      number: `before: ${before1.length} keys; offset: |${after1[0]?.tMs} - ${(s1.clockMs + 500).toFixed(1)}|`,
    })

    // ── 2 · dragging a diamond changes its tMs ──────────────────────────────
    // The lane row includes the label gutter (KEY_GUTTER_PX, 84 px since L6); the time axis is the rest,
    // read as the key's own track so the gutter's width is never assumed.
    const laneW = await ev(() => document.querySelector("[data-key='azimuth:0']")?.parentElement?.clientWidth ?? 0)
    const t0 = after1[0]?.tMs
    const DX = 60
    const expect2 = (DX / laneW) * L
    const tol2 = (L / laneW) * 1.5 + 17
    await drag("[data-key='azimuth:0']", DX, 0)
    const t2 = (await keys()).azimuth?.[0]?.tMs
    await drag("[data-key='azimuth:0']", 0, 0)
    const t2b = (await keys()).azimuth?.[0]?.tMs
    const ok2 = (a, b) => Math.abs(b - a - expect2) <= tol2
    row(2, "dragging a diamond changes its tMs", ok2(t0, t2), `drag ${DX} px on a ${laneW} px lane of ${L} ms: ${t0} -> ${t2} ms, expected +${expect2.toFixed(1)} +/- ${tol2.toFixed(1)}`, {
      what: "same check on a zero-distance press",
      fired: !ok2(t2, t2b),
      number: `${t2} -> ${t2b} ms`,
    })

    // ── 9 · one undo restores exactly one edit (edits: + at 0.4, drag, + at 0.8) ─
    const k1 = await keys()
    await setP(0.8)
    await clickReal("[data-key-add='azimuth']")
    const k2 = await keys()
    await page.mouse.click(5, 5)
    await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z")
    await settle(400)
    const k3 = await keys()
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    row(9, "one undo restores exactly one edit", same(k3, k1) && !same(k2, k1), `azimuth keys ${k1.azimuth?.length} -> ${k2.azimuth?.length} -> undo -> ${k3.azimuth?.length}, equal to the state before the last edit: ${same(k3, k1)}`, {
      what: "same check on the state before undo, and against the state two edits back",
      fired: !same(k2, k1) && !same(k3, { ...k1, azimuth: before1 }) && !same(k3, {}),
      number: `before undo ${k2.azimuth?.length} keys; two back ${before1.length} keys`,
    })

    // ── 3 · an azimuth key moves the rendered view ──────────────────────────
    const full = [
      { tMs: 0, value: 1, easeOut: "linear", easeIn: "linear" },
      { tMs: L, value: 1, easeOut: "linear", easeIn: "linear" },
    ]
    const two = (prop, a, b, extra = {}) => ({ drawProgress: full, [prop]: [{ tMs: 0, value: a, easeOut: "linear", easeIn: "linear" }, { tMs: L, value: b, easeOut: "linear", easeIn: "linear" }], ...extra })
    const atTwo = async (tag) => {
      await setP(0.25)
      const a = await sample()
      await grab(`${tag}a`)
      await setP(0.75)
      const b = await sample()
      await grab(`${tag}b`)
      return { a, b, px: await diffPx(`${tag}a`, `${tag}b`) }
    }
    await setKeys(two("azimuth", 0, 90))
    const az = await atTwo("az")
    await setKeys(two("azimuth", 0, 0))
    const az0 = await atTwo("az0")
    row(3, "an azimuth key moves the rendered view", az.px > 1000, `0->90 key: ${az.px} px moved between ${az.a.clockMs.toFixed(0)} and ${az.b.clockMs.toFixed(0)} ms, camera azimuth ${az.a.camera?.azimuth?.toFixed(1)} -> ${az.b.camera?.azimuth?.toFixed(1)}`, {
      what: "0->0 key must move 0 px",
      fired: az0.px === 0 && !(az0.px > 1000),
      number: `${az0.px} px, camera azimuth ${az0.a.camera?.azimuth?.toFixed(2)} -> ${az0.b.camera?.azimuth?.toFixed(2)}`,
    })

    // ── 4 · a turn key turns the mark ───────────────────────────────────────
    await setKeys(two("turn", 0, 90))
    const tu = await atTwo("tu")
    await setKeys(two("turn", 0, 0))
    const tu0 = await atTwo("tu0")
    const dy = (r) => Math.abs(r.b.applied.yaw - r.a.applied.yaw)
    row(4, "a turn key turns the mark", dy(tu) > 0.1 && tu.px > 1000, `0->90 key: yaw ${tu.a.applied.yaw.toFixed(3)} -> ${tu.b.applied.yaw.toFixed(3)} rad, ${tu.px} px moved`, {
      what: "0->0 key must turn 0 and move 0 px",
      fired: dy(tu0) === 0 && tu0.px === 0,
      number: `yaw ${tu0.a.applied.yaw} -> ${tu0.b.applied.yaw}, ${tu0.px} px`,
    })

    // ── 5 · a depth key changes the depth ───────────────────────────────────
    await setKeys(two("depth", 0.2, 1))
    const de = await atTwo("de")
    await setKeys(two("depth", 0.6, 0.6))
    const de0 = await atTwo("de0")
    const dd = (r) => Math.abs(r.b.applied.depth - r.a.applied.depth)
    row(5, "a depth key changes the depth", dd(de) > 0.01 && de.b.sample.depth > de.a.sample.depth, `0.2->1 key: sampled ${de.a.sample.depth?.toFixed(3)} -> ${de.b.sample.depth?.toFixed(3)}, applied scale.z ${de.a.applied.depth.toFixed(4)} -> ${de.b.applied.depth.toFixed(4)}, ${de.px} px`, {
      what: "flat 0.6 key must leave the applied depth unchanged",
      fired: dd(de0) === 0,
      number: `applied ${de0.a.applied.depth} -> ${de0.b.applied.depth}, ${de0.px} px`,
    })

    // ── 6 · a draw hold at 40% keeps the drawn count flat, then finishes ─────
    const HA = Math.round(L * 0.3),
      HB = Math.round(L * 0.6)
    const holdKeys = (ease) => ({
      drawProgress: [
        { tMs: 0, value: 0, easeOut: "linear", easeIn: "linear" },
        { tMs: HA, value: 0.4, easeOut: ease, easeIn: "linear" },
        { tMs: HB, value: ease === "hold" ? 0.4 : 0.7, easeOut: "linear", easeIn: "linear" },
        { tMs: L, value: 1, easeOut: "linear", easeIn: "linear" },
      ],
    })
    const holdRun = async () => {
      const c = []
      for (const f of [0.32, 0.4, 0.48, 0.56, 0.59]) {
        await setP(f)
        c.push(await drawn())
      }
      await setP(1)
      return { c, end: await drawn(), tot: await total() }
    }
    await setKeys(holdKeys("hold"))
    const h6 = await holdRun()
    await setKeys(holdKeys("linear"))
    const h6f = await holdRun()
    const flat = (r) => r.c.every((v) => v === r.c[0]) && r.c[0] > 0 && r.end === r.tot
    row(6, "a draw hold at 40% stays flat, then finishes", flat(h6), `drawn across the hold ${h6.c.join(",")}; at the end ${h6.end}/${h6.tot}`, {
      what: "same span without the hold (0.4 -> 0.7 linear) must rise",
      fired: !flat(h6f),
      number: `drawn ${h6f.c.join(",")}`,
    })

    // ── 8 · hold holds (a sampled property, then the jump at the next key) ──
    const holdAz = (ease) => ({ azimuth: [{ tMs: 0, value: 0, easeOut: ease, easeIn: "linear" }, { tMs: HB, value: 90, easeOut: "linear", easeIn: "linear" }] })
    const hs = async () => {
      const v = []
      for (const f of [0.1, 0.3, 0.55, 0.62]) {
        await setP(f)
        const s = await sample()
        v.push(+s.sample.azimuth.toFixed(4))
      }
      return v
    }
    await setKeys(holdAz("hold"))
    const h8 = await hs()
    await setKeys(holdAz("linear"))
    const h8f = await hs()
    const holds = (v) => v[0] === 0 && v[1] === 0 && v[2] === 0 && v[3] === 90
    row(8, "hold holds", holds(h8), `azimuth at 10/30/55/62% with the hold ending at 60%: ${h8.join(", ")}`, {
      what: "the same keys with a linear ease out",
      fired: !holds(h8f),
      number: h8f.join(", "),
    })

    // ── 7 · dragging a curve handle moves the midway sample ─────────────────
    const O0 = { x: 0.25, y: 0.25 },
      I0 = { x: 0.75, y: 0.75 }
    await setKeys({ drawProgress: [{ tMs: 0, value: 0, easeOut: O0, easeIn: "linear" }, { tMs: L, value: 1, easeOut: "linear", easeIn: I0 }] })
    await clickReal("[data-key-span='drawProgress:0']")
    await setP(0.5)
    const m0 = await sample()
    const box = await ev(() => {
      const h = document.querySelector("[data-curve-handle='out']")
      const r = h?.parentElement?.getBoundingClientRect()
      return r ? { w: r.width, h: r.height } : null
    })
    const DY = Math.round(box.h * 0.4)
    await drag("[data-curve-handle='out']", 0, -DY)
    const kd = await keys()
    const O1 = kd.drawProgress[0].easeOut
    const I1 = kd.drawProgress[1].easeIn
    await setP(0.5)
    const m1 = await sample()
    const x = m1.clockMs / L
    const want = bez(O1, I1, x)
    const wantOld = bez(O0, I0, m0.clockMs / L)
    const expY = O0.y + DY / box.h
    const ok7 = (got, w) => Math.abs(got - w) <= 0.005
    row(7, "dragging a curve handle moves the midway sample", ok7(m1.sample.drawProgress, want) && Math.abs(O1.y - expY) <= 0.02 && Math.abs(O1.x - O0.x) <= 0.02, `handle y ${O0.y} -> ${O1.y?.toFixed(3)} (expected ${expY.toFixed(3)} for ${DY} px of ${box.h.toFixed(0)}); midway ${m0.sample.drawProgress.toFixed(4)} -> ${m1.sample.drawProgress.toFixed(4)}, expected ${want.toFixed(4)} (moved ${(m1.sample.drawProgress - m0.sample.drawProgress).toFixed(4)}, expected ${(want - wantOld).toFixed(4)})`, {
      what: "post-drag midway sample against the pre-drag curve",
      fired: !ok7(m1.sample.drawProgress, wantOld),
      number: `|${m1.sample.drawProgress.toFixed(4)} - ${wantOld.toFixed(4)}|`,
    })

    // ── 10 · export matches live with keys set, twice ───────────────────────
    const exKeys = {
      drawProgress: [{ tMs: 0, value: 0, easeOut: { x: 0.3, y: 0.1 }, easeIn: "linear" }, { tMs: HA, value: 0.4, easeOut: "hold", easeIn: "linear" }, { tMs: HB, value: 0.4, easeOut: "linear", easeIn: "linear" }, { tMs: L, value: 1, easeOut: "linear", easeIn: { x: 0.7, y: 0.9 } }],
      azimuth: [{ tMs: 0, value: 0, easeOut: "linear", easeIn: "linear" }, { tMs: L, value: 60, easeOut: "linear", easeIn: "linear" }],
      turn: [{ tMs: 0, value: 0, easeOut: "linear", easeIn: "linear" }, { tMs: L, value: 45, easeOut: "linear", easeIn: "linear" }],
      depth: [{ tMs: 0, value: 0.3, easeOut: "linear", easeIn: "linear" }, { tMs: L, value: 1, easeOut: "linear", easeIn: "linear" }],
    }
    await setKeys(exKeys)
    await ev(() => {
      const orig = CanvasRenderingContext2D.prototype.drawImage
      if (window.__akWrapped) return
      window.__akWrapped = true
      CanvasRenderingContext2D.prototype.drawImage = function (src, ...rest) {
        if (window.__akRec && src instanceof HTMLCanvasElement && src.getContext("webgl2")) {
          window.__akGL = src
          const s = window.__fsKeySample()
          window.__akRec.push({ playhead: window.__fsTake.get().live.playhead, clockMs: s.clockMs, sample: s.sample, applied: { depth: s.applied.depth, yaw: s.applied.yaw }, camera: s.camera , lines: window.__akLines })
        }
        return orig.call(this, src, ...rest)
      }
    })
    // ── row 10's pixels (HARDEN-B6) ──────────────────────────────────────────
    // The export is lossy WebM: recordAnimation (lib/export/recorder.ts:102) grabs
    // each frame with renderStill, paints it on #fafafa in an OffscreenCanvas
    // (recorder.ts:207), and WebmEncoder.addFrame hands that canvas to
    // `new VideoFrame` (lib/export/encoders.ts:178) and then VideoEncoder. The
    // frame at `new VideoFrame` is the last lossless copy, so it is read here and
    // must be byte-identical to the live canvas at the same clock. The VP9/VP8
    // stream after it is NOT decoded: this row cannot see an encoder or muxer fault.
    await ev(({ L, HA, HB }) => {
      if (window.__akVFWrapped) return
      window.__akVFWrapped = true
      const OrigVF = window.VideoFrame
      const hash = (u8) => {
        const u = new Uint32Array(u8.buffer, u8.byteOffset, u8.byteLength >> 2)
        let h1 = 0x811c9dc5
        let h2 = 0x9e3779b9 ^ u.length
        for (let i = 0; i < u.length; i++) {
          h1 = Math.imul(h1 ^ u[i], 16777619)
          h2 = (Math.imul(h2 ^ u[i], 2246822519) + i) | 0
        }
        return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0")
      }
      // THE GRID. renderStill hides the fsChrome grid (viewport-3d.tsx, `restoreVisible`),
      // so the export never carries it and the live canvas always does. The grid is the
      // scene's one LINES draw (a gridHelper, drawn first, no depth write). Every LINES
      // draw since the last clear is counted: an export grab must have made 0, and a
      // live grab exactly 1, skipped. Any other line object in the scene fails the row.
      const P = WebGL2RenderingContext.prototype
      const oClear = P.clear
      const oDA = P.drawArrays
      const oDE = P.drawElements
      window.__akLines = 0
      window.__akSkipped = 0
      P.clear = function (...a) {
        window.__akLines = 0
        window.__akSkipped = 0
        return oClear.apply(this, a)
      }
      P.drawArrays = function (mode, ...a) {
        if (mode === this.LINES) {
          window.__akLines++
          if (window.__akSkipLines) return void window.__akSkipped++
        }
        return oDA.call(this, mode, ...a)
      }
      P.drawElements = function (mode, ...a) {
        if (mode === this.LINES) {
          window.__akLines++
          if (window.__akSkipLines) return void window.__akSkipped++
        }
        return oDE.call(this, mode, ...a)
      }
      const THRESH = [[0.25 * L, "25%"], [(HA + HB) / 2, "mid-hold camera move"], [0.75 * L, "75%"]]
      window.__akRunReset = (mf) => {
        window.__akMF = mf || {}
        window.__akVFn = -1
        window.__akRing = []
        window.__akKept = {}
        window.__akKeepHit = []
        window.__akLastCand = null
      }
      window.VideoFrame = function (src, init) {
        const rec = window.__akRec
        if (!rec || !rec.length || !(src && typeof src.width === "number")) return new OrigVF(src, init)
        const w = src.width
        const h = src.height
        const c = document.createElement("canvas")
        c.width = w
        c.height = h
        const x = c.getContext("2d", { willReadFrequently: true })
        x.drawImage(src, 0, 0)
        const idx = (window.__akVFn += 1)
        const e = rec[rec.length - 1]
        const labels = idx === 0 ? ["first"] : []
        THRESH.forEach(([t, name], j) => {
          if (!window.__akKeepHit[j] && e.clockMs >= t) {
            window.__akKeepHit[j] = 1
            labels.push(name)
          }
        })
        const orig = x.getImageData(0, 0, w, h)
        let img = orig
        let swapped = false
        const mf = window.__akMF
        // Must-fail (a): the encoder gets the frame from `shift` frames earlier.
        if (mf.shift > 0) {
          window.__akRing.push(orig)
          if (window.__akRing.length > mf.shift + 1) window.__akRing.shift()
          if (window.__akRing.length === mf.shift + 1) {
            x.putImageData(window.__akRing[0], 0, 0)
            swapped = true
          }
        }
        // Must-fail (b): the mid-hold frame becomes a solid paper fill.
        if (mf.blank && labels.includes("mid-hold camera move")) {
          x.fillStyle = "#fafafa"
          x.fillRect(0, 0, w, h)
          swapped = true
        }
        if (swapped) img = x.getImageData(0, 0, w, h)
        e.pix = { i: idx, w, h, hash: hash(img.data) }
        const K = window.__akKept
        if (window.__akLastCand != null && !K[window.__akLastCand].labels.length) delete K[window.__akLastCand]
        K[idx] = { img, labels }
        window.__akLastCand = idx
        return new OrigVF(swapped ? c : src, init)
      }
      window.VideoFrame.prototype = OrigVF.prototype
      // The live side goes through the same three 2D copies the export makes:
      // renderStill's `out` (paper, then the GL canvas), the recorder's crop
      // (paper, then `out`, cut to the even size), and the reader above.
      const A = document.createElement("canvas")
      const S = document.createElement("canvas")
      let B = null
      window.__akLive = (w, h, i) => {
        const gl = window.__akGL
        A.width = gl.width
        A.height = gl.height
        const ax = A.getContext("2d")
        ax.fillStyle = "#fafafa"
        ax.fillRect(0, 0, A.width, A.height)
        ax.drawImage(gl, 0, 0)
        if (!B || B.width !== w || B.height !== h) B = new OffscreenCanvas(w, h)
        const bx = B.getContext("2d")
        bx.clearRect(0, 0, w, h)
        bx.fillStyle = "#fafafa"
        bx.fillRect(0, 0, w, h)
        bx.drawImage(A, 0, 0)
        S.width = w
        S.height = h
        const sx = S.getContext("2d", { willReadFrequently: true })
        sx.drawImage(B, 0, 0)
        const live = sx.getImageData(0, 0, w, h)
        const out = { hash: hash(live.data), gl: `${gl.width}x${gl.height}`, lines: window.__akLines, skipped: window.__akSkipped }
        const k = window.__akKept[i]
        if (k) {
          let px = 0
          let max = 0
          const a = k.img.data
          const b = live.data
          for (let p = 0; p < a.length; p += 4) {
            const d = Math.max(Math.abs(a[p] - b[p]), Math.abs(a[p + 1] - b[p + 1]), Math.abs(a[p + 2] - b[p + 2]), Math.abs(a[p + 3] - b[p + 3]))
            if (d) px++
            if (d > max) max = d
          }
          const labels = [...k.labels, ...(i === window.__akLastCand ? ["last"] : [])]
          out.named = { labels: labels.join("+"), px, max, of: w * h }
        }
        return out
      }
    }, { L, HA, HB })
    // Two numbers are close only when both are finite. NaN, undefined or null on
    // either side is a mismatch, named by side (HARDEN-B5): NaN against NaN and
    // undefined against undefined used to read as equal.
    const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-6
    const KEYED = Object.keys(exKeys)
    const match = (r, s, la = "export", lb = "live") => {
      const bad = []
      const cmp = (name, a, b) => {
        if (close(a, b)) return
        const sides = [!Number.isFinite(a) && `${la} ${a}`, !Number.isFinite(b) && `${lb} ${b}`].filter(Boolean)
        bad.push(sides.length ? `${name}(${sides.join(", ")})` : name)
      }
      // Every keyed property is compared; an unkeyed one must be absent on both sides.
      for (const k of KEYED) cmp(`sample.${k}`, r.sample?.[k], s.sample?.[k])
      for (const k of new Set([...Object.keys(r.sample ?? {}), ...Object.keys(s.sample ?? {})]))
        if (!KEYED.includes(k) && (r.sample?.[k] !== undefined || s.sample?.[k] !== undefined)) bad.push(`sample.${k}(unkeyed: ${la} ${r.sample?.[k]}, ${lb} ${s.sample?.[k]})`)
      cmp("depth", r.applied?.depth, s.applied?.depth)
      cmp("yaw", r.applied?.yaw, s.applied?.yaw)
      // Azimuth is keyed, so a frame with no camera reading is a failure, never a skip.
      if (!r.camera || !s.camera) bad.push(`camera(absent: ${[!r.camera && la, !s.camera && lb].filter(Boolean).join(", ")})`)
      else for (const k of ["azimuth", "elevation", "distance"]) cmp(`camera.${k}`, r.camera[k], s.camera[k])
      return bad
    }
    const liveCompare = async (rec) => {
      let bad = 0
      const first = []
      let pixN = 0
      let pixBad = 0
      const pixFirst = []
      const named = []
      const sizes = new Set()
      let linesBad = 0
      await ev(() => (window.__akSkipLines = true))
      for (const r of rec) {
        // Seek by the clock the export sampled: clockMs is the playhead times the keyed length.
        await ev((p) => window.__revealHarness.setProgress(p), r.clockMs / L)
        await ev(() => new Promise((q) => requestAnimationFrame(() => requestAnimationFrame(q))))
        const m = match(r, await sample())
        if (m.length) {
          bad++
          if (first.length < 3) first.push(`${r.clockMs.toFixed(0)}ms:${m.join("/")}`)
        }
        // Every frame the encoder got is compared, not a sample; the named ones
        // (first, 25%, mid-hold camera move, 75%, last) also report a pixel count.
        if (r.pix) {
          pixN++
          const g = await ev(({ w, h, i }) => window.__akLive(w, h, i), r.pix)
          sizes.add(`${r.pix.w}x${r.pix.h} from GL ${g.gl}`)
          // Export grab: 0 LINES draws. Live grab: exactly 1, and it was the one skipped.
          if (r.lines !== 0 || g.lines !== 1 || g.skipped !== 1) {
            linesBad++
            if (pixFirst.length < 3) pixFirst.push(`#${r.pix.i} lines export ${r.lines} live ${g.lines}/${g.skipped} skipped`)
          }
          if (g.hash !== r.pix.hash) {
            pixBad++
            if (pixFirst.length < 3) pixFirst.push(`#${r.pix.i}@${r.clockMs.toFixed(0)}ms`)
          }
          if (g.named) named.push(`${g.named.labels} #${r.pix.i}@${r.clockMs.toFixed(0)}ms ${g.named.px}/${g.named.of} px, max ${g.named.max}`)
        }
      }
      await ev(() => (window.__akSkipLines = false))
      return { bad, first, pixN, pixBad, pixFirst, named, sizes: [...sizes], linesBad }
    }
    const exportOnce = async (mf) => {
      await ev((m) => window.__akRunReset(m), mf)
      await ev(() => (window.__akRec = []))
      // Since L3 the Video button is in the dock's Export tab; the lanes are back on Timeline after it.
      await openDock(page, { tab: "export" })
      await Promise.all([page.waitForEvent("download", { timeout: 300000 }), page.locator('button[title*="Save the animation"]').click()])
      await openDock(page, { tab: "timeline" })
      await settle(500)
      const rec = await ev(() => {
        const r = window.__akRec
        window.__akRec = null
        return r
      })
      return rec
    }
    const runs = []
    // Must-fail switches for the pixels, run 1 only: FS_KL_MF_PIX_SHIFT=k hands the
    // encoder the frame from k frames earlier; FS_KL_MF_PIX_BLANK=1 fills the
    // mid-hold frame with solid paper before it is encoded.
    const pixMF = { shift: Number(process.env.FS_KL_MF_PIX_SHIFT) || 0, blank: process.env.FS_KL_MF_PIX_BLANK === "1" }
    if (pixMF.shift || pixMF.blank) console.log(`row 10 pixel must-fail on run 1: ${JSON.stringify(pixMF)}`)
    for (let i = 0; i < 2; i++) {
      const rec = await exportOnce(i === 0 ? pixMF : {})
      // Must-fail switch for absent camera data: run 1's middle frame loses its camera.
      if (process.env.FS_KL_MF_CAMERA === "1" && i === 0 && rec.length > 2) {
        rec[Math.floor(rec.length / 2)].camera = undefined
        console.log(`FS_KL_MF_CAMERA=1: run 1 frame ${Math.floor(rec.length / 2)} of ${rec.length} has camera undefined`)
      }
      const cmp = await liveCompare(rec)
      const moved = rec.length > 2 && rec.at(-1).sample.azimuth !== rec[1].sample.azimuth
      runs.push({ n: rec.length, moved, ...cmp, rec })
    }
    // Frame 0 of each run is grabbed before the first seek, at whatever playhead the
    // page held, so the two runs are compared from frame 1. Each is still checked
    // against live in full.
    const sameRuns = runs[0].n === runs[1].n && runs[0].rec.every((r, i) => i === 0 || match(r, runs[1].rec[i], "run 1", "run 2").length === 0)
    await setKeys({ ...exKeys, azimuth: [exKeys.azimuth[0], { ...exKeys.azimuth[1], value: 90 }] })
    const mf10 = await liveCompare(runs[1].rec)
    // Pixels: every plan frame (all but the probe grab, rec[0]) must have reached
    // `new VideoFrame` and been read, the five named frames must be there, and each
    // frame's bytes must equal live's. The bar is 0 differing bytes, not a threshold:
    // this copy is before the lossy encoder, so there is no codec noise to allow for.
    const pixOk = (r) => r.pixN > 2 && r.pixN === r.n - 1 && r.pixBad === 0 && r.linesBad === 0 && r.named.length === 5
    const pixRunsEqual = runs[0].n === runs[1].n && runs[0].rec.every((r, i) => i === 0 || (r.pix && runs[1].rec[i]?.pix && r.pix.hash === runs[1].rec[i].pix.hash))
    const pixText = (r) => `${r.pixBad}/${r.pixN} frames differ in pixels, ${r.linesBad} break the grid rule (export 0 LINES draws, live 1 skipped)${r.pixFirst.length ? ` (${r.pixFirst.join(" ")})` : ""}`
    row(10, "export matches live with keys set, twice: sampled state, and every frame's pixels at the encoder input", runs.every((r) => r.n > 2 && r.moved && r.bad === 0 && pixOk(r)) && sameRuns && pixRunsEqual, `run 1: ${runs[0].bad}/${runs[0].n} frames differ in state, ${pixText(runs[0])}; run 2: ${runs[1].bad}/${runs[1].n} in state, ${pixText(runs[1])}; runs equal: state ${sameRuns}, pixels ${pixRunsEqual}; bar 0 bytes at ${runs[0].sizes.join(", ")}, read at \`new VideoFrame\` (lib/export/encoders.ts:178), the WebM after VideoEncoder is not decoded; run 1 named: ${runs[0].named.join("; ")}${runs[0].first.length ? `; ${runs[0].first.join(" ")}` : ""}`, {
      what: "run 2's frames against live after the azimuth end key moves 60 -> 90",
      fired: mf10.bad > 0 && mf10.pixBad > 0,
      number: `${mf10.bad}/${runs[1].n} frames differ in state, ${mf10.pixBad}/${mf10.pixN} in pixels, e.g. ${mf10.first.join(" ")}; named ${mf10.named.join("; ")}`,
    })

    // ── 12-16 · width keys, the clamp note, the camera picker ───────────────
    const lanesOpen = async () => {
      if ((await ev(() => document.querySelector("[data-key-lanes]")?.getAttribute("data-open"))) !== "1") await clickReal("[data-key-lanes]")
    }
    const setMode = async (m) => {
      await ev((x) => window.__styleHarness.setMode(x), m)
      await settle(1500)
      for (const p of [0, 0.5, 1, 0]) await setP(p)
    }
    const W_PS = [0.1, 0.4, 0.7, 1]
    const flatW = (v) => [{ tMs: 0, value: v, easeOut: "linear", easeIn: "linear" }, { tMs: L, value: v, easeOut: "linear", easeIn: "linear" }]
    /** The clamp note's text, and whether it shows whole (the line truncates). */
    const note = () =>
      ev(() => {
        const el = document.querySelector("[data-width-clamp]")
        return el ? { text: el.textContent, fits: el.scrollWidth <= el.clientWidth } : null
      })
    // Ink is counted against this engine's empty scene, the no-keys frame at 0
    // with nothing drawn. A count against the background colour read the scene
    // itself: it moved 8% from 10% drawn to all of it, so it could not see the mark.
    const grabW = async (tag, plate) => {
      const h = {}
      const ink = {}
      for (const p of W_PS) {
        await setP(p)
        await settle(300)
        h[p] = await grab(`${tag}${p}`)
        ink[p] = await diffPx(plate, `${tag}${p}`)
      }
      return { h, ink, gl: (await sizes()).gl, open: await ev(() => document.querySelector("[data-key-lanes]")?.getAttribute("data-open")), note: await note() }
    }
    const W = {}
    for (const mode of ["rod", "solid"]) {
      await setMode(mode)
      await ev(() => window.__fsSetKeys(undefined))
      await settle(400)
      await lanesOpen()
      await setP(0)
      await settle(300)
      const plateDrawn = await drawn()
      await grab(`${mode}plate`)
      const none = await grabW(`${mode}n`, `${mode}plate`)
      await setP(1)
      await settle(300)
      const fullDrawn = await drawn()
      await setKeys({ width: flatW(1) })
      await lanesOpen()
      await settle(800)
      const w1 = await grabW(`${mode}w1`, `${mode}plate`)
      await setKeys({ width: flatW(2) })
      await lanesOpen()
      await settle(800)
      const w2 = await grabW(`${mode}w2`, `${mode}plate`)
      W[mode] = { none, w1, w2, plateDrawn, fullDrawn }
    }
    const nSameW = (a, b) => W_PS.filter((p) => a.h[p] === b.h[p]).length
    const likeW = (a, b) => a.open === "1" && b.open === "1" && a.gl === b.gl
    const identW = (a, b) => likeW(a, b) && nSameW(a, b) === W_PS.length
    const widens = (a, b) => likeW(a, b) && W_PS.every((p) => a.ink[p] > b.ink[p] * 1.1)
    const uIdent = NOKEY_PS.every((p) => uw1[p] === nokeys[p]) && uw1Sizes.gl === nkSizes.gl
    const inkRow = (r) => W_PS.map((p) => r.ink[p]).join(",")
    // The plate must hold nothing drawn, or the ink counts carry the mark on both sides.
    const modesOk = ["rod", "solid"].every((m) => W[m].fullDrawn > 0 && W[m].plateDrawn < 0.01 * W[m].fullDrawn && identW(W[m].w1, W[m].none) && widens(W[m].w2, W[m].none))
    row(12, "a width key at 2 widens the mark on Rod and Solid, and 1 is byte-identical", modesOk && uIdent, ["rod", "solid"].map((m) => `${m}: width 1 ${nSameW(W[m].w1, W[m].none)}/${W_PS.length} frames equal to no keys, ink at 10/40/70/100% ${inkRow(W[m].none)} -> width 2 ${inkRow(W[m].w2)} px against a near-empty plate (${W[m].plateDrawn} of ${W[m].fullDrawn} drawn, under 1%: Rod's pen-start stub), canvas ${W[m].none.gl} lanes open`).join("; ") + `; undocked width 1 ${NOKEY_PS.filter((p) => uw1[p] === nokeys[p]).length}/${NOKEY_PS.length} equal at canvas ${uw1Sizes.gl} (no keys ${nkSizes.gl})` + `; sizes ` + ["rod", "solid"].map((m) => `${m} none ${W[m].none.gl}/${W[m].none.open} w1 ${W[m].w1.gl}/${W[m].w1.open} w2 ${W[m].w2.gl}/${W[m].w2.open}`).join(" "), {
      what: "the identity check on width 2, and the widening check on width 1, both engines",
      fired: ["rod", "solid"].every((m) => !identW(W[m].w2, W[m].none) && !widens(W[m].w1, W[m].none)),
      number: ["rod", "solid"].map((m) => `${m}: width 2 ${nSameW(W[m].w2, W[m].none)}/${W_PS.length} equal, width 1 ink ${inkRow(W[m].w1)}`).join("; "),
    })

    const noteRe = /^Solid draws this at (\d+\.\d\d)x\. Any wider and the counters close\.$/
    const clampOk = (n) => {
      const m = noteRe.exec(n?.text ?? "")
      return !!m && Number(m[1]) > 1 && Number(m[1]) < 2 && n.fits
    }
    row(13, "Solid at 2 shows its clamp note", clampOk(W.solid.w2.note), `Solid, width keyed at 2: ${JSON.stringify(W.solid.w2.note)}`, {
      what: "the same check on Rod at 2 and on Solid at 1, where nothing clamps",
      fired: !clampOk(W.rod.w2.note) && !clampOk(W.solid.w1.note),
      number: `Rod at 2: ${JSON.stringify(W.rod.w2.note)}; Solid at 1: ${JSON.stringify(W.solid.w1.note)}`,
    })

    // Settle to front, with a turn and a width track it must leave alone.
    await setMode("rod")
    const kPrePre = await keys()
    await setKeys({ turn: [{ tMs: 0, value: 0, easeOut: "linear", easeIn: "linear" }, { tMs: L, value: 15, easeOut: "linear", easeIn: "linear" }], width: flatW(1.25) })
    const kPre = await keys()
    await lanesOpen()
    await clickReal("[data-camera-picker]")
    const opts = await ev(() =>
      [...document.querySelectorAll("[data-camera-move]")].map((b) => ({
        id: b.getAttribute("data-camera-move"),
        refused: b.getAttribute("data-refused") === "1",
        disabled: b.disabled,
        reason: b.querySelector("[data-camera-reason]")?.textContent ?? "",
      })),
    )
    const opt = (id) => opts.find((o) => o.id === id)
    await clickReal("[data-camera-move='orbit-lifts']")
    const kRef = await keys()
    if (!(await ev(() => !!document.querySelector("[data-camera-moves]")))) await clickReal("[data-camera-picker]")
    await clickReal("[data-camera-move='settle-front']")
    const kPost = await keys()
    const closed = !(await ev(() => !!document.querySelector("[data-camera-moves]")))
    const changed = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort().join(",")
    const [mvA, mvB] = [kPost.azimuth?.[0], kPost.azimuth?.[1]]
    const [e0, e1] = [kPost.elevation?.[0], kPost.elevation?.[1]]
    /** The camera and the drawn count at the move's start, 5% of the take before its landing, and the landing. */
    const camRun = async (tag) => {
      const at = async (ms, n) => {
        await setP(ms / L)
        await settle(300)
        const s = await sample()
        await grab(`${tag}${n}`)
        return { ms: Math.round(ms), az: s.camera?.azimuth, el: s.camera?.elevation, drawn: await drawn() }
      }
      const a = await at(mvA.tMs, "s")
      const before = await at(Math.max(mvA.tMs, mvB.tMs - 0.05 * L), "p")
      const b = await at(mvB.tMs, "l")
      return { a, before, b, px: await diffPx(`${tag}s`, `${tag}l`), tot: await total() }
    }
    const near = (u, v) => Number.isFinite(u) && Math.abs(u - v) <= 0.1
    const lands = (c) => near(c.a.az, mvA.value) && near(c.a.el, e0.value) && near(c.b.az, mvB.value) && near(c.b.el, e1.value) && !near(c.before.az, mvB.value) && c.px > 1000 && c.before.drawn < c.tot && c.b.drawn === c.tot
    const camTxt = (c) => `azimuth ${c.a.az?.toFixed(2)} at ${c.a.ms} ms, ${c.before.az?.toFixed(2)} at ${c.before.ms}, ${c.b.az?.toFixed(2)} at ${c.b.ms}; elevation ${c.a.el?.toFixed(2)} -> ${c.b.el?.toFixed(2)}; drawn ${c.before.drawn} then ${c.b.drawn}/${c.tot}; ${c.px} px moved`
    const camPost = mvA && mvB && e0 && e1 ? await camRun("sf") : null

    // One undo takes the pick back.
    await page.mouse.click(5, 5)
    await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z")
    await settle(400)
    const kU = await keys()
    const camU = camPost ? await camRun("sfu") : null

    const ok14 = changed(kPre, kPost) === "azimuth,elevation" && kPost.azimuth.length === 2 && kPost.elevation.length === 2 && closed && !!camPost && lands(camPost)
    row(14, "picking Settle to front writes only its tracks, and the view lands with the drawing", ok14, `tracks changed: ${changed(kPre, kPost)}; keys azimuth ${mvA?.value} -> ${mvB?.value}, elevation ${e0?.value} -> ${e1?.value}, ${mvA?.tMs} to ${mvB?.tMs} ms; list closed ${closed}; ${camPost ? camTxt(camPost) : "no camera keys"}`, {
      what: "the same check on the take before the pick (after the undo)",
      fired: changed(kPre, kU) !== "azimuth,elevation" && !!camU && !lands(camU),
      number: `tracks changed: "${changed(kPre, kU)}"; ${camU ? camTxt(camU) : "not measured"}`,
    })

    const refusedOk = (o, before, after) => !!o && o.refused && o.disabled && /^Can't run here: ./.test(o.reason) && same(before, after)
    const listOk = opts.length === 4 && opts.every((o) => o.refused === o.reason.startsWith("Can't run here: "))
    row(15, "a refused move writes nothing and shows its reason", refusedOk(opt("orbit-lifts"), kPre, kRef) && /lifts/.test(opt("orbit-lifts").reason) && listOk, `Turn in the lifts: refused ${opt("orbit-lifts")?.refused}, disabled ${opt("orbit-lifts")?.disabled}, "${opt("orbit-lifts")?.reason}"; keys equal after the click ${same(kPre, kRef)}; ${opts.filter((o) => o.refused).length} of ${opts.length} listed as refused`, {
      what: "the same check on Settle to front and its click",
      fired: !refusedOk(opt("settle-front"), kPre, kPost),
      number: `refused ${opt("settle-front")?.refused}, keys equal after the click ${same(kPre, kPost)}`,
    })

    row(16, "one undo removes a picked move", same(kU, kPre) && !same(kPost, kPre), `tracks ${Object.keys(kPre).sort()} -> pick -> ${Object.keys(kPost).sort()} -> undo -> ${Object.keys(kU).sort()}, equal to before the pick: ${same(kU, kPre)}`, {
      what: "the same check on the state before the undo, and against the state before the take's keys",
      fired: !same(kPost, kPre) && !same(kPrePre, kPre),
      number: `before undo ${Object.keys(kPost).sort()}; before the keys ${Object.keys(kPrePre).sort()}`,
    })

    // ── 11 · no keys: frames byte-identical to the base commit ──────────────
    // baseRec was read and its sha checked before the browser launched.
    const base = baseRec?.frames ?? null
    // A base file with no window, or another window or canvas, is no comparison.
    const why11 = !baseRec
      ? "no nokeys-base.json"
      : !baseRec.window || baseRec.window !== nkSizes.window
        ? `window ${nkSizes.window} against the base's ${baseRec.window ?? "(unrecorded)"}`
        : baseRec.gl !== nkSizes.gl
          ? `canvas ${nkSizes.gl} against the base's ${baseRec.gl}`
          : ""
    const eq = (a, b) => !!a && !why11 && NOKEY_PS.every((p) => a[p] === b[p])
    const nEq = (a) => (base ? NOKEY_PS.filter((p) => base[p] === a[p]).length : 0)
    row(11, "no keys: byte-identical to the base commit", eq(base, nokeys), `${nEq(nokeys)}/${NOKEY_PS.length} frames equal at window ${nkSizes.window}, canvas ${nkSizes.gl}; branch ${JSON.stringify(nokeys)}${why11 ? ` (${why11})` : ""}`, {
      what: "the same page with a 0->30 azimuth key against the base",
      fired: !!base && !why11 && !eq(base, keyed),
      number: `${nEq(keyed)}/${NOKEY_PS.length} equal`,
    }, self11)
    if (self11) console.log(`      row 11: base ${baseRec.sha.slice(0, 9)} has the served code (${srv.head.slice(0, 9)}), so it compares the tree to itself`)
    for (const r of runs) delete r.rec
    // SELF rows count toward the 16-row total; they are never in the pass count.
    const graded = rows.filter((r) => !r.self)
    const selfRows = rows.filter((r) => r.self)
    const pass = graded.filter((r) => r.pass).length
    writeFileSync(join(OUT, "assert-key-lanes.json"), JSON.stringify({ url: LAB_URL, at: new Date().toISOString(), server: srv, base: { sha: baseRec?.sha ?? null, recordedFrom: baseRec?.recordedFrom ?? null }, lengthMs: L, pass, graded: graded.length, self: selfRows.map((r) => r.id), of: rows.length, rows }, null, 2))
    console.log(`\n${pass}/${graded.length} graded rows pass; ${selfRows.length} SELF, not graded${selfRows.length ? ": " + selfRows.map((r) => `${r.id} ${r.name}`).join("; ") : ""}; ${rows.length} of 16 rows`)
    process.exitCode = pass === graded.length && graded.length + selfRows.length === 16 ? 0 : 1
  }
} finally {
  await browser.close()
}

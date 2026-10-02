#!/usr/bin/env node
/* ============================================================================
 * assert-handfix-browser: the two CLOUD-HANDFIX findings that need the page
 * (REVIEW.md, Review 2, findings 5 and 6). The Node half is
 * `assert-handfix.mjs`.
 *
 *   FS_HEADED=0 FS_PORT=<your dev server> node scripts/verify/assert-handfix-browser.mjs
 *
 * B5  A pace-only change under a timed take (Grow to Travel, the Authentic
 *     pace, the hybrid blend) changes the take's key, and the tip bake's lifts
 *     (`__heroPenTip.lifts`, the stillness the frame loop holds and the lifts
 *     "Turn in the lifts" must agree with) are the lifts a fresh page with the
 *     same settings bakes. Must-fail `timed-sig-no-pace`: the pace out of the
 *     key, so the bake keeps the old pace's lifts.
 * B6  Inflate, Hand, Window Vanish, one +1 ms row: the trailing edge stands
 *     still in every pen lift of 50 ms or more (0 px change across the lift),
 *     while the same span inside the stroke before it moves. Must-fail
 *     `tip-no-trail-liftholds`: the hold back on the leading edge only.
 *
 * Every row has its must-fail run in a fresh context with the knockout set
 * before load; it counts only when its row goes red. Exit 0 all green and
 * every must-fail fired, 1 otherwise.
 * ========================================================================== */
import { readFileSync } from "node:fs"
import sharp from "sharp"
const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")

const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const ROWS = {
  B5: "B5 a pace-only change (Travel, Authentic, blend) rekeys the take, and the tip bake's lifts are a fresh page's",
  B6: "B6 Inflate, Hand, Vanish, a timed take: the trailing edge stands still in every lift of 50 ms or more, the stroke before moves",
}
const MUST_FAIL = { B5: "timed-sig-no-pace", B6: "tip-no-trail-liftholds" }
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7)

const browser = await chromium.launch()

async function run(mutate, which) {
  const rows = {}
  const row = (k, ok, detail = "") => {
    rows[k] = { ok: !!ok, detail }
    console.log(`${mutate ? `[${mutate}] ` : ""}${ok ? "PASS" : "FAIL"}  ${k}  (${detail})`)
  }
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 })
  if (mutate) await ctx.addInitScript((m) => { window.__FS_GATE_MUTATE = m }, mutate)
  const page = await ctx.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  const settle = async (ms = 400) => { await page.waitForTimeout(ms); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))) }
  const ready = () => page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__fsTake && window.__fsClock && window.__fsTransport, null, { timeout: 240000 })
  const open = async () => {
    await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
    await ready()
    await page.evaluate(() => { try { localStorage.clear() } catch {} })
    await page.reload({ waitUntil: "domcontentloaded" }); await ready()
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys); await settle(1200)
    await page.evaluate(() => window.__styleHarness.selectMotionPreset("handDraw")); await settle(600)
    await page.evaluate(() => { window.__styleHarness.setMode("inflate"); window.__styleHarness.setInflate({ fusion: "auto" }) }); await settle(2500)
  }
  const lastRow = async () => {
    const n = await page.evaluate(() => window.__fsClock.get().clocked.length)
    await page.evaluate((i) => window.__fsTake.set({ [i]: { delayMs: 1, speed: 1, ease: { kind: "preset", id: "linear" }, holdBack: false } }), n - 1); await settle(1500)
  }
  /* The bake runs when the tip is drawn, at a partial reveal. */
  const baked = async () => {
    await page.evaluate(() => window.__revealHarness.setProgress(0.37)); await settle(600)
    await page.evaluate(() => window.__revealHarness.setProgress(0.5)); await settle(800)
    return page.evaluate(() => ({ lifts: window.__heroPenTip?.lifts ?? null, sig: window.__fsTake.get().sig, timed: window.__fsTake.get().timed }))
  }
  const sameLifts = (a, b) => !!a && !!b && a.length === b.length && a.every((v, k) => Math.abs(v - b[k]) <= 0.1)
  try {
    if (!which || which === "B5") {
      await open(); await lastRow()
      const nat = await baked()
      await page.evaluate(() => window.__fsTransport.set("modeOverride", "raw")); await settle(800)
      const raw = await baked()
      await page.evaluate(() => window.__fsTransport.set("modeOverride", null)); await page.evaluate(() => window.__fsTransport.set("hybridBlend", 0.7)); await settle(800)
      const blend = await baked()
      await page.evaluate(() => window.__fsTransport.set("hybridBlend", 0.4)); await settle(400)
      await page.evaluate(() => window.__revealHarness.setWindow({ mode: "travel" })); await settle(1200)
      const live = await baked()
      // A fresh page with Travel set before the row: what the bake must hold.
      await open()
      await page.evaluate(() => window.__revealHarness.setWindow({ mode: "travel" })); await settle(1200)
      await lastRow()
      const fresh = await baked()
      const keys = [raw.sig !== nat.sig, blend.sig !== nat.sig, live.sig !== nat.sig]
      const L = (x) => (x ? `[${x.map((v) => v.toFixed(1)).join(" ")}]` : "none")
      row("B5", nat.timed && keys.every(Boolean) && live.sig === fresh.sig && sameLifts(live.lifts, fresh.lifts) && !sameLifts(nat.lifts, fresh.lifts),
        `timed ${nat.timed}; key changes on Authentic ${keys[0]}, blend ${keys[1]}, Travel ${keys[2]}; Grow lifts ${L(nat.lifts)}; Travel live ${L(live.lifts)}; Travel fresh ${L(fresh.lifts)}`)
    }
    if (!which || which === "B6") {
      await open()
      await page.evaluate(() => window.__revealHarness.setWindow({ mode: "vanish" })); await settle(1200)
      await lastRow()
      const cl = await page.evaluate(() => window.__fsClock.get())
      const rect = await page.evaluate(() => { const c = [...document.querySelectorAll("canvas")].filter((x) => x.getContext("2d") === null).sort((a, b) => b.width * b.height - a.width * a.height)[0]; if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })
      const total = await page.evaluate(() => window.__revealHarness.getTotalDuration())
      const grab = async (ms) => {
        await page.evaluate((p) => window.__revealHarness.setProgress(p), ms / total); await settle(200)
        return sharp(await page.screenshot({ clip: rect })).raw().toBuffer()
      }
      const diff = (A, B) => { let n = 0; for (let k = 0; k < A.length; k += 3) if (A[k] !== B[k] || A[k + 1] !== B[k + 1] || A[k + 2] !== B[k + 2]) n++; return n }
      const out = []
      for (let i = 0; i + 1 < cl.clocked.length; i++) {
        const a0 = cl.clocked[i], b0 = cl.clocked[i + 1], t0 = a0[a0.length - 1].t, t1 = b0[0].t
        if (t1 - t0 < 50) continue
        const a = t0 + 2, b = t1 - 2, ref = await grab(a)
        let creep = 0
        for (let k = 1; k <= 4; k++) creep = Math.max(creep, diff(ref, await grab(a + ((b - a) * k) / 4)))
        const c0 = Math.max(a0[0].t, t0 - (b - a) - 2)
        out.push({ after: i, creep, control: diff(await grab(c0), await grab(c0 + (b - a))) })
      }
      const st = await page.evaluate(() => ({ timed: !!window.__fsTake.get().timed, mode: window.__revealHarness.window().mode }))
      row("B6", st.timed && st.mode === "vanish" && out.length > 0 && out.every((r) => r.creep === 0 && r.control > 0),
        `timed ${st.timed}, window ${st.mode}, ${out.length} lifts of 50 ms or more; px changed across each lift [${out.map((r) => r.creep).join(" ")}], worst ${Math.max(0, ...out.map((r) => r.creep))}; controls [${out.map((r) => r.control).join(" ")}]`)
    }
    rows.errors = errors.slice(0, 3)
  } catch (e) {
    rows.crash = String(e).slice(0, 300)
    console.log(`CRASH ${mutate ?? "real"}: ${rows.crash}`)
  } finally {
    await ctx.close()
  }
  return rows
}

const keys = Object.keys(ROWS).filter((k) => !ONLY || k === ONLY)
const real = await run(null, ONLY)
const mf = {}
for (const k of keys) {
  const r = await run(MUST_FAIL[k], k)
  mf[k] = { fired: r[k] ? !r[k].ok : false, detail: r[k]?.detail ?? r.crash ?? "row not reached" }
}
await browser.close()
const green = keys.filter((k) => real[k]?.ok)
const fired = keys.filter((k) => mf[k].fired)
console.log(`\nREAL: ${green.length} of ${keys.length} rows green`)
for (const k of keys) console.log(`MUST-FAIL ${mf[k].fired ? "FIRED" : "SILENT"}  ${k} <- ${MUST_FAIL[k]}  (${mf[k].detail})`)
console.log(`MUST-FAIL: ${fired.length} of ${keys.length} fired`)
console.log(`page errors: ${real.errors?.length ?? "n/a"}${real.errors?.length ? " " + real.errors.join(" | ") : ""}`)
process.exit(green.length === keys.length && fired.length === keys.length && !real.crash ? 0 : 1)

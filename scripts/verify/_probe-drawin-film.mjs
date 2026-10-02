// Real-time PLAY, filmed, on the shipped build. Watched back as a contact sheet.
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, existsSync, readdirSync, renameSync } from "node:fs"
import { stageEvidence } from "./lib/evidence-swap.mjs"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
const require = createRequire(import.meta.url)
let FFMPEG = require("ffmpeg-static"); if (!FFMPEG || !existsSync(FFMPEG)) FFMPEG = "ffmpeg"
// ...AND THE SAME DEFECT ON THE OUTPUT SIDE, IN ITS WORST FORM. This read
// an ABSOLUTE path naming the canonical checkout and its play-after evidence
// dir — and the next line `rmSync`s it.
// So a lane running this capture on its own port did not merely file wrong
// evidence in the shared checkout: it DELETED the shared checkout's stored
// evidence first. Destroying evidence is strictly worse than writing bad
// evidence, because a wrong frame can be re-graded and a deleted one cannot.
// `assert-one-knob` cannot see this: the defect is a PATH, not a URL.
// Derived from the script's own location; in the canonical tree it resolves
// byte-identically to the string it replaces.
// ...AND THE WIPE ITSELF, WHICH THE PARAGRAPH ABOVE NEVER TOUCHED. It fixed the
// PATH the `rmSync` was aimed at and left the `rmSync`, so this script still
// emptied the stored set before spending 20 s refilling it. The run now writes
// to a staging dir and the stored set is replaced only once the sheet exists.
// One shared mechanism, `lib/evidence-swap.mjs`, applied here and in 48 others.
const FINAL = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "verification", "drawin-vanish", "play-after")
const EV = stageEvidence(FINAL)
const OUT = EV.dir
EV.open()
const VIEW = { width: 1600, height: 1600 }
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: VIEW, deviceScaleFactor: 1, recordVideo: { dir: OUT, size: VIEW } })
const page = await ctx.newPage()
const errors = []
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))
await page.goto(HERO_URL, { waitUntil: "networkidle" })
await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
await page.waitForTimeout(2500)
await page.click('[data-engine-option="desk-doodles"]')
await page.waitForTimeout(3500)
await page.evaluate(() => { for (const inp of document.querySelectorAll('input[type="range"]')) { const t=(inp.closest("div")?.parentElement?.textContent??"").toLowerCase(); if (t.includes("wobble")) { const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set; s.call(inp,"0"); inp.dispatchEvent(new Event("input",{bubbles:true})); inp.dispatchEvent(new Event("change",{bubbles:true})); break } } })
await page.waitForTimeout(2500)
await page.evaluate(() => { for (const btn of document.querySelectorAll("button")) if ((btn.textContent??"").trim().toLowerCase()==="clean") { btn.click(); break } })
await page.waitForTimeout(2500)
await page.evaluate(() => { document.querySelectorAll("button").forEach(x => { if ((x.textContent??"").trim().toLowerCase()==="reset") x.click() }) })
await page.waitForTimeout(1200)
// FRAME TIMES, measured on the gesture he performs: load, PLAY, watch.
await page.evaluate(() => { window.__ft = []; let l = performance.now(); const f=()=>{const n=performance.now(); window.__ft.push(n-l); l=n; requestAnimationFrame(f)}; requestAnimationFrame(f) })
await page.click("[data-hero-play]")
await page.waitForTimeout(14000)
const ft = await page.evaluate(() => window.__ft.slice(30))
ft.sort((a,z)=>a-z)
const q = (p) => ft[Math.min(ft.length-1, Math.floor(ft.length*p))]
console.log(`rAF frames ${ft.length}  median ${q(0.5).toFixed(2)} ms  p95 ${q(0.95).toFixed(2)}  worst ${ft[ft.length-1].toFixed(2)}  over 33ms: ${ft.filter(x=>x>33).length}  over 100ms: ${ft.filter(x=>x>100).length}`)
console.log("page errors:", errors.length ? errors.join(" | ") : 0)
await ctx.close(); await b.close()
for (const f of readdirSync(OUT).filter(f=>f.endsWith(".webm"))) { renameSync(`${OUT}/${f}`, `${OUT}/play.webm`); break }
execFileSync(FFMPEG, ["-y","-i",`${OUT}/play.webm`,"-c:v","libx264","-pix_fmt","yuv420p",`${OUT}/play.mp4`], { stdio: "ignore" })
mkdirSync(`${OUT}/frames`, { recursive: true })
execFileSync(FFMPEG, ["-y","-i",`${OUT}/play.mp4`,"-vf","fps=6,crop=1280:400:160:520","-q:v","2",`${OUT}/frames/%03d.png`], { stdio: "ignore" })
const sheet = readdirSync(`${OUT}/frames`).length
/* THE SWAP. The only moment `play-after` is written at all. */
EV.commit()
console.log("film:", FINAL, sheet, "sheet frames")

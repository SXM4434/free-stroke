// WHY DOES `networkidle` NEVER SETTLE? — the measurement behind the headless trap.
//
// `assert-fusion-combo-ui.mjs` dies at 30 s headless and is 14/14 headed, and
// 49 of this repo's 100 gates open their page with
// `page.goto(..., { waitUntil: "networkidle" })`. This probe does not guess at a
// cause: it navigates with `waitUntil: "commit"` (which always resolves), then
// records every request the page makes for a fixed window and prints the LAST
// arrival and the longest quiet gap. Playwright's `networkidle` fires after
// 500 ms with no more than 2 in-flight requests, so a run whose longest gap
// never reaches 500 ms names the thing keeping it busy.
//
//   node scripts/verify/_probe-networkidle.mjs                # headless
//   FS_HEADED=1 node scripts/verify/_probe-networkidle.mjs    # headed
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "..", "docs", "verification", "harness-2026-08-28")
const WINDOW_MS = Number(process.env.PROBE_WINDOW_MS || 25000)
const MODE = process.env.FS_HEADED === "1" ? "headed" : "headless"

const browser = await chromium.launch({})
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })

const events = []
const t0 = Date.now()
let inflight = 0
let peak = 0
page.on("request", (r) => {
  inflight++
  peak = Math.max(peak, inflight)
  events.push({ t: Date.now() - t0, kind: "req", url: r.url().slice(0, 140), type: r.resourceType() })
})
const done = (r) => {
  inflight = Math.max(0, inflight - 1)
  events.push({ t: Date.now() - t0, kind: "done", url: r.url().slice(0, 140) })
}
page.on("requestfinished", done)
page.on("requestfailed", done)
page.on("websocket", (ws) => events.push({ t: Date.now() - t0, kind: "ws", url: ws.url().slice(0, 140) }))

// ── AND THE SECOND QUESTION, WHICH TURNED OUT TO BE THE REAL ONE ───────────
// Three browser gates gave different verdicts on two runs of the SAME mode.
// Both failures were the page losing its harness mid-run: "Execution context
// was destroyed, most likely because of a navigation", and a `window.__…` that
// had become undefined. So this also sits still and counts what the page does
// while nobody is touching it. A page that navigates on its own explains every
// one of those reds, in either mode.
page.on("framenavigated", (f) => {
  if (f === page.mainFrame()) events.push({ t: Date.now() - t0, kind: "nav", url: f.url().slice(0, 140) })
})
page.on("load", () => events.push({ t: Date.now() - t0, kind: "load", url: "" }))
page.on("crash", () => events.push({ t: Date.now() - t0, kind: "crash", url: "" }))
page.on("pageerror", (e) => events.push({ t: Date.now() - t0, kind: "pageerror", url: String(e).slice(0, 140) }))

await page.goto(LAB_URL, { waitUntil: "commit" })

// the actual question, asked directly and given its own budget
let idleMs = null
let idleErr = null
const idleStart = Date.now()
page
  .waitForLoadState("networkidle", { timeout: WINDOW_MS })
  .then(() => {
    idleMs = Date.now() - idleStart
  })
  .catch((e) => {
    idleErr = String(e).split("\n")[0]
  })

await new Promise((r) => setTimeout(r, WINDOW_MS))

// longest stretch with nothing arriving, over the whole window
const arrivals = events.filter((e) => e.kind === "req").map((e) => e.t)
let longestGap = arrivals.length ? arrivals[0] : WINDOW_MS
for (let i = 1; i < arrivals.length; i++) longestGap = Math.max(longestGap, arrivals[i] - arrivals[i - 1])
const tail = arrivals.length ? WINDOW_MS - arrivals[arrivals.length - 1] : WINDOW_MS
longestGap = Math.max(longestGap, tail)

// who keeps arriving after the first 3 s — the page has loaded by then
const late = events.filter((e) => e.kind === "req" && e.t > 3000)
const byUrl = new Map()
for (const e of late) byUrl.set(e.url, (byUrl.get(e.url) || 0) + 1)
const top = [...byUrl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

const report = {
  mode: MODE,
  url: LAB_URL,
  windowMs: WINDOW_MS,
  totalRequests: arrivals.length,
  requestsAfter3s: late.length,
  longestQuietGapMs: longestGap,
  lastArrivalMs: arrivals.length ? arrivals[arrivals.length - 1] : null,
  peakInflight: peak,
  networkidleResolvedAfterMs: idleMs,
  networkidleError: idleErr,
  websockets: events.filter((e) => e.kind === "ws").map((e) => e.url),
  topLateRequesters: top.map(([url, n]) => ({ n, url })),
  // everything below is the unattended-page question, not the networkidle one
  mainFrameNavigations: events.filter((e) => e.kind === "nav").length,
  loadsAfterFirst: Math.max(0, events.filter((e) => e.kind === "load").length - 1),
  crashes: events.filter((e) => e.kind === "crash").length,
  pageErrors: events.filter((e) => e.kind === "pageerror").map((e) => e.url).slice(0, 5),
}
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, `networkidle-${MODE}.json`), JSON.stringify({ report, events }, null, 2) + "\n")
console.log(JSON.stringify(report, null, 2))
await browser.close()

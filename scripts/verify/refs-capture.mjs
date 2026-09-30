// refs-capture.mjs — THE PROVENANCE GATE for competitive references.
//
// PORTED, not recreated, from the shared capture gate at
//   ~/Desktop/Projects/portfolio/portfolio-system-lab/docs/system/_capture/refs-capture.mjs
// (Oz, 2026-07-16 — the IMAGE-GATE SWEEP). Constants, comments and the failure
// cases it was written against are carried across intact; the only changes are
// the driver (playwright-core + system Chrome + --use-angle=metal, which is what
// every other harness in this repo uses) and the manifest location.
//
// WHY IT EXISTS, in one sentence: `page.goto()` does NOT throw on an HTTP error
// status, so the naive recipe `goto(); screenshot()` saves a picture of a 404 to
// disk and a gate that counts files passes it. Three fabricated mechanism claims
// in the portfolio repo were written from a URL slug over a screenshot of an
// error page. A citation is not evidence.
//
// It also does not stop at ok() — a 200 can be a Cloudflare interstitial, a
// login wall, a paused deployment, a consent modal, or the right site with all
// its CSS dead. Each of those is a real casualty found on disk, named below.
//
// USAGE
//   import { openBrowser, captureRef, writeManifest, verifyRefs } from "./refs-capture.mjs"
//   node scripts/verify/refs-capture.mjs --selftest   # mutation test: known-bad MUST fail
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { chromium } from "./lib/browser.mjs"

// ── error-page signatures ────────────────────────────────────────────────────
// Matched against <title> + the first <h1> ONLY (not whole-body text): body text
// matching produced false positives (a real page ABOUT 404 design, a nav with a
// "Sign in" link). Title/h1 is where a genuine error page announces itself.
const HARD_ERROR_PATTERNS = [
  /\b404\b/i, /\b403\b/i, /\b5\d\d\b/, /page not found/i, /not found/i,
  /access denied/i, /forbidden/i, /attention required/i, /just a moment/i,
  /security check/i, /are you a robot/i,
  /this page (does ?n[o']t exist|isn'?t available)/i, /server error/i,
  /service unavailable/i, /bad gateway/i, /rate limit/i, /too many requests/i,
  // The DOMINANT failure mode in the 2026-07-16 sweep (7+ on disk). A Cloudflare
  // interstitial is often HTTP 200, so response.ok() alone never catches it.
  /performing security verification/i,
  /verif(y|ying) (that )?you are (a )?human/i,
  /checking your browser/i,
  /enable javascript and cookies to continue/i,
  /ddos protection by/i,
  /website expired/i,
  /domain (has )?expired/i,
  /this site can'?t be reached/i,
]

// ── PLATFORM-DEAD signatures ─────────────────────────────────────────────────
// Found by EYE on disk, not by the gate: a Vercel "This deployment is
// temporarily paused" page is HTTP 200, has NO <h1>, and its title is the site
// name. Every check above passes it. Gated on a SHORT body so a real article
// about deployments cannot false-positive.
const PLATFORM_DEAD_MAX_TEXT = 600
const PLATFORM_DEAD_PATTERNS = [
  /this deployment is temporarily paused/i,
  /this deployment has been (disabled|deleted)/i,
  /deployment not found/i,
  /this project has been (deleted|archived)/i,
  /the deployment could not be found/i,
  /this site has been (archived|suspended|disabled)/i,
  /repository not found/i,
  /this content is no longer available/i,
  /build failed/i,
  /application error/i,
  /no such app/i,
]

// Soft signals — a 200 that painted the WRONG thing.
const SOFT_BLOCK_SELECTORS = [
  '[id*="cookie" i]', '[class*="cookie" i]', '[id*="consent" i]', '[class*="consent" i]',
  '[aria-label*="cookie" i]', '[id*="gdpr" i]', '[class*="gdpr" i]',
  '[role="dialog"]', '[class*="modal" i][class*="open" i]', '[class*="paywall" i]',
  '[class*="login-wall" i]', '[id*="onetrust" i]', '[class*="ot-sdk" i]',
]

export async function openBrowser({ width = 1440, height = 900, scale = 2 } = {}) {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  })
  const page = await context.newPage()
  return { browser, page }
}

async function pageSignals(page) {
  return await page.evaluate((softSelectors) => {
    const title = (document.title || "").trim()
    const h1 = (document.querySelector("h1")?.innerText || "").trim()
    const bodyText = (document.body?.innerText || "").trim()
    const elCount = document.querySelectorAll("body *").length
    let styleSheets = 0
    try { styleSheets = document.styleSheets.length } catch { styleSheets = -1 }
    const linkCount = document.querySelectorAll('link[rel="stylesheet"]').length
    // LOGIN-WALL detect — precise on purpose: a password field ALONE is not a
    // wall, and a login-ish heading alone is not either. Require BOTH.
    const hasPassword = !!document.querySelector('input[type="password"]')
    const loginish = /^(log ?in|sign ?in|sign ?up|create (an )?account)\b/i.test(
      (document.querySelector("h1")?.innerText || document.title || "").trim())
    const loginWall = hasPassword && loginish
    const blockers = []
    for (const sel of softSelectors) {
      try {
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect()
          const cs = getComputedStyle(el)
          if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) continue
          const areaFrac = (r.width * r.height) / (innerWidth * innerHeight)
          const fixed = cs.position === "fixed" || cs.position === "sticky"
          if (areaFrac > 0.06 && (fixed || areaFrac > 0.25)) {
            blockers.push({ sel, areaFrac: +areaFrac.toFixed(3), text: (el.innerText || "").slice(0, 80) })
          }
        }
      } catch { /* bad selector on this page — ignore */ }
    }
    return { title, h1, bodyText: bodyText.slice(0, 2000), bodyLen: bodyText.length,
             elCount, styleSheets, linkCount, loginWall, blockers }
  }, SOFT_BLOCK_SELECTORS)
}

/**
 * Capture ONE reference. THROWS on a gate failure — that is the entire point.
 * @returns {Promise<object>} provenance record
 */
export async function captureRef(page, url, outPath, opts = {}) {
  const {
    waitUntil = "networkidle",
    timeout = 45000,
    settle = 1500,
    fullPage = false,
    allowStatus = [],
    allowSoftBlockers = false,
    allowUnstyled = false,
    beforeShot = null,
    minBytes = 8000,
  } = opts

  const checks = { url, out: path.basename(outPath), at: new Date().toISOString() }

  // ── 0 · watch SUBRESOURCES ────────────────────────────────────────────────
  // A 200 document whose CSS + images all failed saves as raw blue link-lists
  // and broken-image icons — zero reference signal. response.ok() on the
  // DOCUMENT says nothing about that, so count the corpse pile.
  const subres = { cssTotal: 0, cssFailed: 0, imgTotal: 0, imgFailed: 0 }
  const onResp = (r) => {
    const t = r.request().resourceType()
    const bad = r.status() >= 400
    if (t === "stylesheet") { subres.cssTotal++; if (bad) subres.cssFailed++ }
    if (t === "image") { subres.imgTotal++; if (bad) subres.imgFailed++ }
  }
  page.on("response", onResp)
  const cleanup = () => page.off("response", onResp)

  // ── 1 · NAVIGATE + ASSERT THE RESPONSE ────────────────────────────────────
  let resp
  try {
    resp = await page.goto(url, { waitUntil, timeout })
  } catch (e) {
    // networkidle can time out on pages with long-poll sockets while the page
    // itself is perfectly painted. Retry once on `load`, then let the paint
    // assertions below do the judging — they are the real gate.
    try {
      resp = await page.goto(url, { waitUntil: "load", timeout })
    } catch (e2) {
      cleanup()
      throw new Error(`REFS-GATE FAIL · navigation threw · ${url}\n  ${e.message}\n  retry: ${e2.message}`)
    }
  }
  if (!resp) { cleanup(); throw new Error(`REFS-GATE FAIL · no response object · ${url}`) }

  const status = resp.status()
  checks.status = status
  checks.ok = resp.ok()
  if (!resp.ok() && !allowStatus.includes(status)) {
    cleanup()
    throw new Error(
      `REFS-GATE FAIL · HTTP ${status} (ok=false) · ${url}\n` +
      `  page.goto() does NOT throw on this — that is the bug this gate exists to catch.\n` +
      `  This URL is DEAD or BLOCKED. Do not save a screenshot of it as a reference.`
    )
  }
  if (allowStatus.includes(status) && !resp.ok()) checks.allowedStatus = status

  if (settle) await page.waitForTimeout(settle)
  if (beforeShot) await beforeShot(page)

  // ── 2 · ASSERT THE PAINTED RESULT ISN'T AN ERROR PAGE ─────────────────────
  const sig = await pageSignals(page)
  checks.title = sig.title
  checks.h1 = sig.h1
  checks.bodyLen = sig.bodyLen
  checks.elCount = sig.elCount

  const hay = `${sig.title}\n${sig.h1}`
  const hit = HARD_ERROR_PATTERNS.find((re) => re.test(hay))
  if (hit) {
    cleanup()
    throw new Error(
      `REFS-GATE FAIL · error-page signature in title/h1 · ${url}\n` +
      `  title: ${JSON.stringify(sig.title)}\n  h1: ${JSON.stringify(sig.h1)}\n` +
      `  matched: ${hit}\n` +
      `  (HTTP status was ${status} — a SOFT error: the server said OK and painted an error.)`
    )
  }

  // ── 2b · PLATFORM-DEAD ────────────────────────────────────────────────────
  if (sig.bodyLen < PLATFORM_DEAD_MAX_TEXT) {
    const deadHit = PLATFORM_DEAD_PATTERNS.find((re) => re.test(sig.bodyText))
    if (deadHit) {
      cleanup()
      throw new Error(
        `REFS-GATE FAIL · platform-dead page (status ${status}, no error in title/h1) · ${url}\n` +
        `  title: ${JSON.stringify(sig.title)}\n  bodyText: ${JSON.stringify(sig.bodyText.slice(0, 120))}\n` +
        `  matched: ${deadHit} (bodyTextLen=${sig.bodyLen} < ${PLATFORM_DEAD_MAX_TEXT})`
      )
    }
  }

  // ── 3 · ASSERT IT PAINTED SOMETHING AT ALL ────────────────────────────────
  if (sig.elCount < 5 || sig.bodyLen < 10) {
    cleanup()
    throw new Error(
      `REFS-GATE FAIL · page never painted · ${url}\n` +
      `  elements=${sig.elCount} bodyTextLen=${sig.bodyLen} — blank/near-blank capture.`
    )
  }

  // ── 3b · THE PAGE LOADED BUT THE STYLING DIDN'T ───────────────────────────
  checks.subres = subres
  checks.styleSheets = sig.styleSheets
  const cssAllDead = subres.cssTotal > 0 && subres.cssFailed === subres.cssTotal
  const unstyled = sig.styleSheets === 0 && sig.linkCount > 3
  if ((cssAllDead || unstyled) && !allowUnstyled) {
    cleanup()
    throw new Error(
      `REFS-GATE FAIL · page painted UNSTYLED (status ${status}) · ${url}\n` +
      `  stylesheets applied=${sig.styleSheets} · css ${subres.cssFailed}/${subres.cssTotal} failed · images ${subres.imgFailed}/${subres.imgTotal} failed`
    )
  }
  if (subres.imgTotal > 4 && subres.imgFailed / subres.imgTotal > 0.5 && !allowUnstyled) {
    cleanup()
    throw new Error(
      `REFS-GATE FAIL · ${subres.imgFailed}/${subres.imgTotal} images failed to load · ${url}\n` +
      `  A visual reference whose images 404'd is not a visual reference.`
    )
  }

  // ── 3c · LOGIN WALL ───────────────────────────────────────────────────────
  checks.loginWall = sig.loginWall
  if (sig.loginWall && !allowSoftBlockers) {
    cleanup()
    throw new Error(
      `REFS-GATE FAIL · LOGIN WALL (status ${status}) · ${url}\n` +
      `  title: ${JSON.stringify(sig.title)} · h1: ${JSON.stringify(sig.h1)} · password field present`
    )
  }

  // ── 4 · SOFT BLOCKERS ─────────────────────────────────────────────────────
  checks.blockers = sig.blockers
  if (sig.blockers.length && !allowSoftBlockers) {
    cleanup()
    throw new Error(
      `REFS-GATE FAIL · overlay obscures the content (status ${status}, a SOFT-200) · ${url}\n` +
      sig.blockers.map((b) => `    ${b.sel} covers ${(b.areaFrac * 100).toFixed(0)}% — ${JSON.stringify(b.text)}`).join("\n") +
      `\n  A cookie-modal screenshot is not a reference.`
    )
  }

  // ── 5 · SHOOT + fingerprint ───────────────────────────────────────────────
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  const buf = await page.screenshot({ path: outPath, fullPage })
  const bytes = buf?.length ?? fs.statSync(outPath).size
  checks.bytes = bytes
  checks.sha256 = crypto.createHash("sha256").update(fs.readFileSync(outPath)).digest("hex")

  if (bytes < minBytes) {
    cleanup()
    throw new Error(
      `REFS-GATE FAIL · screenshot is ${bytes}B — almost certainly blank · ${url}\n  saved to ${outPath} for inspection.`
    )
  }

  checks.verdict = "PASS"
  cleanup()
  return checks
}

/** Append/merge provenance records into <dir>/_capture-manifest.json */
export function writeManifest(refsDir, records) {
  const p = path.join(refsDir, "_capture-manifest.json")
  let prev = []
  if (fs.existsSync(p)) { try { prev = JSON.parse(fs.readFileSync(p, "utf8")) } catch { /* rewrite */ } }
  const byOut = new Map(prev.map((r) => [r.out, r]))
  for (const r of records) byOut.set(r.out, r)
  const merged = [...byOut.values()].sort((a, b) => String(a.out).localeCompare(String(b.out)))
  fs.mkdirSync(refsDir, { recursive: true })
  fs.writeFileSync(p, JSON.stringify(merged, null, 2))
  return p
}

/**
 * THE GATE. Replaces "N image files on disk".
 * A ref counts ONLY if it has a manifest record proving an asserted, ok() capture
 * AND the file on disk still hashes to what was captured.
 */
export function verifyRefs(refsDir, { min = 8 } = {}) {
  const exts = new Set([".png", ".jpg", ".jpeg", ".webp"])
  const imgs = fs.existsSync(refsDir)
    ? fs.readdirSync(refsDir).filter((f) => exts.has(path.extname(f).toLowerCase()) && !f.startsWith("_contact"))
    : []
  const mp = path.join(refsDir, "_capture-manifest.json")
  const manifest = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, "utf8")) : []
  const byOut = new Map(manifest.map((r) => [r.out, r]))

  const verified = [], unverified = [], bad = []
  for (const f of imgs) {
    const rec = byOut.get(f)
    if (!rec) { unverified.push(f); continue }
    const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(refsDir, f))).digest("hex")
    if (rec.sha256 && rec.sha256 !== sha) { bad.push(`${f} (sha mismatch — file changed since capture)`); continue }
    if (rec.ok === false && !rec.allowedStatus) { bad.push(`${f} (captured with HTTP ${rec.status})`); continue }
    verified.push(f)
  }
  const pass = verified.length >= min && bad.length === 0
  return { pass, min, onDisk: imgs.length, verified, unverified, bad,
    summary: `${verified.length}/${imgs.length} image(s) provenance-verified · ${unverified.length} unverified · ${bad.length} bad · gate ${pass ? "PASS" : "FAIL"}` }
}

/* ------------------------------------------------------------------ */
/*  MUTATION TEST — the gate must FAIL on a known-bad input.          */
/*                                                                    */
/*  §0.5's whole point: a gate that cannot fail is the lie. So this   */
/*  drives four known-bad URLs and REQUIRES each to throw, plus one   */
/*  known-good to prove it is not simply refusing everything.         */
/* ------------------------------------------------------------------ */
async function selftest() {
  const tmp = path.join(process.cwd(), "docs", "refs-competitive", "_selftest")
  fs.mkdirSync(tmp, { recursive: true })
  /* ONE BROWSER, A FRESH PAGE PER CASE. Reusing a page across a deliberately
   * failed navigation was measured to poison the NEXT case: the known-good
   * control came back "navigation threw" on a URL that captures cleanly on its
   * own page. A negative control that fails for the wrong reason proves
   * nothing, so the cases are isolated. */
  const { browser, page: firstPage } = await openBrowser({ width: 1200, height: 800, scale: 1 })
  const context = firstPage.context()
  await firstPage.close()
  const rows = []

  /* MOST CASES ARE SERVED LOCALLY, ON PURPOSE. The first version of this
   * selftest drove `httpbin.org/status/500` and hung the whole run past 300 s
   * on a third-party host — a gate nobody can afford to run is a gate nobody
   * runs. The interesting failures are SOFT ones anyway (a 200 that painted an
   * error, a consent wall, a blank paint), and those are exactly reproducible
   * from a route handler. One real network case is kept, because the whole
   * reason this file exists is that `page.goto()` does not throw on a genuine
   * HTTP 404 with a body. */
  const SERVED = {
    "soft-404": { status: 200, body: "<!doctype html><title>404 Not Found</title><h1>Page not found</h1><p>x</p><div>a</div><div>b</div><div>c</div><div>d</div>" },
    "cloudflare": { status: 200, body: "<!doctype html><title>Just a moment...</title><h1>Checking your browser</h1><p>Please wait</p><div>a</div><div>b</div><div>c</div><div>d</div>" },
    "blank": { status: 200, body: "<!doctype html><title>ok</title><body></body>" },
    "paused": { status: 200, body: "<!doctype html><title>my-site</title><body><div>This deployment is temporarily paused</div><div>a</div><div>b</div><div>c</div><div>d</div></body>" },
    "good": { status: 200, body: "<!doctype html><title>A real page</title><h1>A real page</h1><p>" + "Real content. ".repeat(40) + "</p><div>a</div><div>b</div><div>c</div><div>d</div>" },
  }

  const run = async (label, url, expected, route) => {
    const p = await context.newPage()
    if (route) await p.route("https://gate.test/**", (r) => {
      const key = new URL(r.request().url()).pathname.slice(1)
      const s = SERVED[key]
      return s ? r.fulfill({ status: s.status, contentType: "text/html", body: s.body }) : r.fulfill({ status: 404, body: "no" })
    })
    let threw = null
    try {
      await captureRef(p, url, path.join(tmp, `${label}.png`), { settle: 200, timeout: 20000, minBytes: 500, waitUntil: "load" })
    } catch (e) { threw = e.message.split("\n")[0] }
    await p.close()
    const got = threw ? "FAIL" : "PASS"
    rows.push({ label, expected, got, why: threw ?? "captured" })
  }

  await run("soft-404", "https://gate.test/soft-404", "FAIL", true)
  await run("cloudflare", "https://gate.test/cloudflare", "FAIL", true)
  await run("blank", "https://gate.test/blank", "FAIL", true)
  await run("paused-deployment", "https://gate.test/paused", "FAIL", true)
  // The one real network case: a genuine HTTP 404 that returns a body.
  await run("github-404", "https://github.com/anthropics/this-repo-does-not-exist-2026", "FAIL", false)
  // The control that proves the gate is not simply refusing everything.
  await run("good", "https://gate.test/good", "PASS", true)

  await browser.close()

  let allOk = true
  for (const r of rows) {
    const ok = r.expected === r.got
    if (!ok) allOk = false
    console.log(`${ok ? "PASS" : "FAIL"}  ${r.label}\n        expected ${r.expected}, got ${r.got} — ${r.why}`)
  }
  console.log(`\nrefs-capture selftest: ${allOk ? "SOUND — the gate fails on known-bad and passes known-good" : "BROKEN"}`)
  process.exit(allOk ? 0 : 1)
}

if (process.argv[2] === "--selftest") await selftest()

export { HARD_ERROR_PATTERNS, SOFT_BLOCK_SELECTORS }

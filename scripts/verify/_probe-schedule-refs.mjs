// _probe-schedule-refs.mjs — LANE 5 capture-only probe.
//
// Captures implementation-level scheduling/stagger references for the per-stroke
// SCHEDULE model, through the repo's OWN provenance gate (refs-capture.mjs).
// Nothing here hand-rolls a screenshot: every image must survive captureRef's
// status / error-page / platform-dead / blank-paint / unstyled / login-wall /
// overlay assertions or it is RECORDED AS REJECTED and no file is kept.
//
//   node scripts/verify/_probe-schedule-refs.mjs
import fs from "node:fs"
import path from "node:path"
import { openBrowser, captureRef, writeManifest, verifyRefs } from "./refs-capture.mjs"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..")
const REFS = path.join(ROOT, "docs", "verification", "stroke-schedule", "refs")

// ── targets ──────────────────────────────────────────────────────────────────
// `urls` is tried in order. Every attempt — pass or reject — is recorded.
const TARGETS = [
  {
    n: "01", slug: "animejs-stagger",
    subject: "anime.js stagger() full parameter list",
    urls: [
      "https://animejs.com/documentation/stagger",
      "https://animejs.com/documentation/animation/tween-value-types/function-based",
    ],
  },
  {
    n: "02", slug: "gsap-staggers",
    subject: "GSAP advanced stagger object (each/amount/from/grid/axis/ease)",
    urls: [
      "https://gsap.com/resources/getting-started/Staggers/",
      "https://gsap.com/docs/v3/Staggers/",
    ],
  },
  {
    n: "03", slug: "blender-gp-build-modifier",
    subject: "Blender Grease Pencil Build modifier (Mode/Transition/Timing/Time Alignment/Delay)",
    urls: [
      "https://docs.blender.org/manual/en/latest/grease_pencil/modifiers/generate/build.html",
      "https://docs.blender.org/manual/en/4.2/grease_pencil/modifiers/generate/build.html",
    ],
  },
  {
    n: "04", slug: "ae-sequence-layers",
    subject: "After Effects Sequence Layers keyframe assistant (Overlap/Duration/Transition)",
    urls: [
      "https://helpx.adobe.com/after-effects/using/animating-layers.html",
      "https://helpx.adobe.com/after-effects/using/keyframe-interpolation.html",
    ],
  },
  {
    n: "05", slug: "cavalry-stagger",
    subject: "Cavalry Stagger behaviour + Stagger Graph",
    urls: [
      "https://cavalry.scenegroup.co/docs/behaviours/stagger",
      "https://cavalry.studio/docs/behaviours/stagger",
      // Third only if both above are rejected: this exact URL is already
      // provenance-verified in this repo (docs/verification/anim-map/refs
      // ref-21, HTTP 200, 2026-08-05).
      "https://cavalry.studio/docs/nodes/behaviours/stagger/",
    ],
  },
  {
    n: "06", slug: "motion-stagger",
    subject: "Motion (framer-motion) stagger() with from and ease",
    urls: [
      "https://motion.dev/docs/stagger",
      "https://motion.dev/docs/animate",
    ],
  },
  {
    n: "07", slug: "mdn-cubic-bezier",
    subject: "cubic-bezier() exact parametric definition (needed to INVERT an easing)",
    urls: [
      "https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/cubic-bezier",
      "https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function",
    ],
  },
  {
    n: "08", slug: "counting-sort",
    subject: "counting sort stability + complexity",
    urls: [
      "https://en.wikipedia.org/wiki/Counting_sort",
      "https://en.m.wikipedia.org/wiki/Counting_sort",
    ],
  },
]

// ── escape hatch ─────────────────────────────────────────────────────────────
// ONLY used on a retry after the gate rejected for an overlay/consent blocker.
// It dismisses the modal by clicking its own accept control — it does not hide
// anything the site did not offer to hide.
async function dismissConsent(page) {
  await page.evaluate(() => {
    const wants = /^(accept|accept all|allow all|i agree|agree|got it|ok|close|dismiss|continue)\b/i
    const cands = [...document.querySelectorAll('button, [role="button"], a.btn, .cky-btn, #onetrust-accept-btn-handler')]
    for (const el of cands) {
      const t = (el.innerText || el.getAttribute("aria-label") || "").trim()
      if (wants.test(t)) { try { el.click() } catch { /* keep going */ } }
    }
  })
  await page.waitForTimeout(700)
}

// Full page text for the sidecar (pageSignals only keeps the first 2000 chars).
async function fullText(page) {
  return await page.evaluate(() => ({
    title: (document.title || "").trim(),
    text: (document.body?.innerText || "").trim(),
  }))
}

function writeSidecar(txtPath, { url, at, status, title, text }) {
  const header =
    `URL: ${url}\n` +
    `CAPTURED: ${at}\n` +
    `HTTP: ${status}\n` +
    `TITLE: ${title}\n` +
    "=".repeat(70) + "\n\n"
  fs.writeFileSync(txtPath, header + text + "\n")
  return fs.statSync(txtPath).size
}

// ── run ──────────────────────────────────────────────────────────────────────
const { browser, page: firstPage } = await openBrowser({ width: 1440, height: 900, scale: 2 })
const context = firstPage.context()
await firstPage.close()

const manifestRecords = []
const results = []   // every attempt, pass or reject
const rejected = []

for (const t of TARGETS) {
  const outPng = path.join(REFS, `ref-${t.n}-${t.slug}.png`)
  const outTxt = path.join(REFS, `ref-${t.n}-${t.slug}.txt`)
  let done = false

  for (const url of t.urls) {
    if (done) break
    for (const hatch of [null, "dismiss"]) {
      if (done) break
      // FRESH PAGE PER ATTEMPT — refs-capture's own selftest measured that
      // reusing a page across a failed navigation poisons the next attempt.
      const p = await context.newPage()
      try {
        const rec = await captureRef(p, url, outPng, {
          settle: 2000,
          timeout: 60000,
          beforeShot: hatch === "dismiss" ? dismissConsent : null,
        })
        const ft = await fullText(p)
        const txtBytes = writeSidecar(outTxt, {
          url, at: rec.at, status: rec.status, title: ft.title || rec.title, text: ft.text,
        })
        rec.refNo = t.n
        rec.subject = t.subject
        rec.escapeHatch = hatch
        rec.txt = path.basename(outTxt)
        rec.txtBytes = txtBytes
        manifestRecords.push(rec)
        results.push({ n: t.n, slug: t.slug, url, hatch, verdict: "PASS",
                       status: rec.status, ok: rec.ok, pngBytes: rec.bytes, txtBytes })
        console.log(`PASS  ref-${t.n}-${t.slug}  HTTP ${rec.status}  ${url}${hatch ? `  [hatch=${hatch}]` : ""}`)
        done = true
      } catch (e) {
        const reason = e.message
        // Only bother with the dismiss retry when the rejection was an overlay.
        const overlayish = /overlay obscures the content/i.test(reason)
        if (hatch === null && !overlayish) {
          results.push({ n: t.n, slug: t.slug, url, hatch, verdict: "REJECTED", reason })
          rejected.push({ n: t.n, slug: t.slug, url, reason })
          console.log(`REJECT ref-${t.n}-${t.slug}  ${url}\n  ${reason.split("\n").slice(0, 3).join("\n  ")}`)
          await p.close()
          break // next URL
        }
        if (hatch === "dismiss") {
          results.push({ n: t.n, slug: t.slug, url, hatch, verdict: "REJECTED", reason })
          rejected.push({ n: t.n, slug: t.slug, url: `${url} [retry with consent-dismiss]`, reason })
          console.log(`REJECT ref-${t.n}-${t.slug}  ${url} [hatch=dismiss]\n  ${reason.split("\n").slice(0, 3).join("\n  ")}`)
        }
      } finally {
        if (!p.isClosed()) await p.close()
      }
    }
  }
  if (!done) {
    // Never leave a partial/faked artefact behind for a target that failed.
    for (const f of [outPng, outTxt]) if (fs.existsSync(f)) fs.unlinkSync(f)
    console.log(`NO CAPTURE for ref-${t.n}-${t.slug} — every URL rejected.`)
  }
}

await browser.close()

const mp = writeManifest(REFS, manifestRecords)
fs.writeFileSync(path.join(REFS, "_capture-results.json"), JSON.stringify(results, null, 2))

const v = verifyRefs(REFS, { min: TARGETS.length })
console.log(`\nmanifest: ${mp}`)
console.log(`VERIFY: ${v.summary}`)
if (v.unverified.length) console.log(`  unverified: ${v.unverified.join(", ")}`)
if (v.bad.length) console.log(`  bad: ${v.bad.join(", ")}`)
if (rejected.length) {
  console.log(`\nREJECTED (${rejected.length}):`)
  for (const r of rejected) console.log(`  ref-${r.n}-${r.slug} · ${r.url}\n    ${r.reason.split("\n")[0]}`)
}
process.exit(v.pass ? 0 : 1)

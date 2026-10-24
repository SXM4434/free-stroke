// capture-competitive-refs.mjs — the Lane 21 reference set, captured through
// the provenance gate in ./refs-capture.mjs.
//
// EVERY entry below is a claim that a page exists AND says something. The gate
// turns the first half into a fact (status, paint, styling, no wall, sha256 in
// `_capture-manifest.json`). The second half is NOT machine-checkable and is
// not claimed here — the write-up in docs/research/ names what was SEEN in each
// saved PNG, and anything the picture does not show is not written down.
//
//   node scripts/verify/capture-competitive-refs.mjs            # capture all
//   node scripts/verify/capture-competitive-refs.mjs --only=ccapture
//   node scripts/verify/capture-competitive-refs.mjs --verify    # re-gate disk
import path from "node:path"
import { fileURLToPath } from "node:url"
import { openBrowser, captureRef, writeManifest, verifyRefs } from "./refs-capture.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REFS = path.join(__dirname, "..", "..", "docs", "refs-competitive")

/** slug · url · what we went there to find out · capture options */
const SET = [
  {
    slug: "ref-01-procreate-timelapse",
    url: "https://help.procreate.com/procreate/handbook/actions/actions-video",
    why: "The precedent for selling recorded process: every canvas records a time-lapse, and the export is a first-class Actions entry.",
  },
  {
    slug: "ref-02-jitter-product",
    url: "https://jitter.video/product/",
    why: "Browser motion tool. What it exports, and which export capabilities sit behind the paywall.",
    fullPage: true,
  },
  {
    slug: "ref-03-rotato-exporting",
    url: "https://rotato.app/help/topic/exporting",
    why: "A paid indie 3D→video tool's export surface: formats, transparency, frame rate, and what it calls them.",
  },
  {
    slug: "ref-04-womp-doodles-to-3d",
    url: "https://www.womp.com/blogs/from-doodles-to-3d-turning-sketches-into-stunning-3d-models-with-womp",
    why: "The nearest neighbour: drawing → 3D in a browser, and how it frames that promise to a non-3D user.",
    fullPage: true,
  },
  {
    slug: "ref-05-mediabunny",
    url: "https://mediabunny.dev/guide/introduction",
    why: "Pure-TS WebCodecs muxing toolkit (MPL-2.0). The build-vs-depend decision for animated export.",
  },
  {
    slug: "ref-06-webcodecs-muxing",
    url: "https://webcodecsfundamentals.org/basics/muxing/",
    why: "The mechanism: an encoder gives you chunks, a container is a separate problem.",
  },
  {
    slug: "ref-07-mdn-videoencoder",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder",
    why: "The real API surface we would encode through, including what it needs per frame.",
  },
  {
    slug: "ref-08-ccapture",
    url: "https://github.com/spite/ccapture.js",
    why: "Frame-locked capture by hijacking the clock — the technique that makes an export deterministic rather than real-time.",
  },
  {
    slug: "ref-09-blender-grease-pencil",
    url: "https://docs.blender.org/manual/en/latest/grease_pencil/introduction.html",
    why: "The one mature system where a drawn stroke IS a 3D object, with its own stroke order and thickness model.",
  },
  {
    slug: "ref-10-illustrator-3d",
    // First URL tried, `.../using/3d-effects.html`, is a LIVE 404 — the gate
    // refused it (2026-08-01). Kept in this comment because the write-up would
    // otherwise have been authored from a slug, which is the exact fabrication
    // class §0.5 names.
    url: "https://helpx.adobe.com/illustrator/using/about-3d-effects-illustrator.html",
    why: "The incumbent for vector art → 3D. What the industry-standard control set is called.",
  },
  {
    slug: "ref-11-monster-mash",
    url: "https://monstermash.zone/",
    why: "Sketch → inflated 3D, the published research our Inflate mode is a cousin of, with an in-browser demo.",
  },
  {
    slug: "ref-12-spline-export",
    // `docs.spline.design/doc/exporting-videos/docPWWk8Y1Rl` is a LIVE 404 —
    // refused by the gate, 2026-08-01. Same note as ref-10.
    url: "https://docs.spline.design/exporting-your-scene/files/exporting-as-video",
    why: "How a funded browser 3D tool words and bounds its video export, and what it calls frame-locked capture.",
  },
  {
    slug: "ref-13-gifenc",
    url: "https://github.com/mattdesl/gifenc",
    why: "A fast dependency-free GIF encoder — the other half of 'shareable', since GIF still autoplays where video does not.",
  },
  {
    slug: "ref-14-webm-writer",
    url: "https://github.com/Vanilagy/webm-muxer",
    why: "A minimal WebM/Matroska muxer for WebCodecs output, including its alpha-channel support — the format we can write ourselves.",
  },
  {
    slug: "ref-15-jitter-pricing",
    url: "https://jitter.video/pricing/",
    why: "Where the paywall actually sits in this category — which export capabilities are free and which are paid.",
    fullPage: true,
  },
]

const args = process.argv.slice(2)
const only = args.find((a) => a.startsWith("--only="))?.split("=")[1] ?? null

if (args.includes("--verify")) {
  const v = verifyRefs(REFS, { min: 8 })
  console.log(v.summary)
  for (const f of v.verified) console.log(`  ok       ${f}`)
  for (const f of v.unverified) console.log(`  UNVERIF  ${f}`)
  for (const f of v.bad) console.log(`  BAD      ${f}`)
  process.exit(v.pass ? 0 : 1)
}

const { browser, page: first } = await openBrowser({ width: 1440, height: 900, scale: 2 })
const context = first.context()
await first.close()

const records = []
const failures = []
for (const entry of SET) {
  if (only && !entry.slug.includes(only)) continue
  const out = path.join(REFS, `${entry.slug}.png`)
  const p = await context.newPage()
  try {
    const rec = await captureRef(p, entry.url, out, {
      settle: 2000,
      timeout: 60000,
      fullPage: !!entry.fullPage,
      allowSoftBlockers: !!entry.allowSoftBlockers,
      allowStatus: entry.allowStatus ?? [],
    })
    rec.why = entry.why
    records.push(rec)
    console.log(`PASS  ${entry.slug}  HTTP ${rec.status}  ${rec.bytes}B  "${rec.title}"`)
  } catch (e) {
    failures.push({ slug: entry.slug, url: entry.url, error: e.message })
    console.log(`FAIL  ${entry.slug}\n      ${e.message.split("\n").slice(0, 3).join("\n      ")}`)
  }
  await p.close()
}
await browser.close()

if (records.length) writeManifest(REFS, records)
console.log(`\n${records.length} captured · ${failures.length} refused by the gate`)
const v = verifyRefs(REFS, { min: 8 })
console.log(v.summary)
process.exit(failures.length && records.length < 8 ? 1 : 0)

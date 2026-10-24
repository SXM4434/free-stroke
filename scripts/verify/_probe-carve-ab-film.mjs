// THE FILM — the carve driven by the BEAT, beside the beat without it.
//
// ⚠ IT DOES NOT REPLACE `_probe-carve-film.mjs`, WHICH IS PARKED AND STILL
// RUNS. That probe drove `penCarve` through `__captureHarness.setFlatten` at a
// fixed pose and ramped it on `easeOutBack`, because at the time nothing in the
// model published the channel and the only way to see it move was to move it by
// hand. `lib/hero-motion.ts` publishes it now, so the honest film is the BEAT'S
// OWN — and a hand-driven ramp standing beside the beat would be a second,
// disagreeing account of one gesture. Both are kept; this one is the shipped
// read.
//
// What it builds, all from captures already on disk (no browser, no dev server):
//
//   sheet-carve.png    one frame per named PHASE, driven arm
//   sheet-prior.png    the same instants, parked arm
//   zoom-flat.png      the held flat mark from both arms, cropped and 3x
//                      nearest-neighbour — the surface itself
//   ab-strip.png       the same held frame, both arms, whole word
//   ab-emerge.mp4      the turn, side by side, at the emerge window's own rate
//   realtime.mp4       the beat on the page's own clock, trimmed out of the
//                      session recording, + a contact sheet of it
//
// One frame per PHASE rather than eight evenly-spaced ones: an even grid over a
// beat whose phases are wildly different lengths spends most of its cells on the
// draw.
//
// The zoom is why this is a probe and not a gate. The difference between a
// nib-drawn word and a swept tube is a SHAPE judgement on a boundary, and no
// statistic on this page has ever been able to stand in for looking at it.
//
// Usage: node scripts/verify/_probe-carve-ab-film.mjs [--label=carve] [--prior=carve-prior]
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
let FFMPEG = require("ffmpeg-static")
if (!FFMPEG || !existsSync(FFMPEG)) FFMPEG = "ffmpeg"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "carve")
const PRIOR = arg("prior", "carve-prior")
const OUT = join(ROOT, "docs", "verification", "pen-carve", "film")
const dirFor = (l) => join(ROOT, "docs", "verification", "hero-transition", l)

/** Stack frames with a caption strip, at `scale`, optionally cropped. */
async function stack(files, captions, scale, crop = null) {
  const imgs = await Promise.all(files.map((f) => loadImage(f)))
  const cw = crop ? crop.w : imgs[0].width
  const ch = crop ? crop.h : imgs[0].height
  const CAP = 26
  const c = createCanvas(Math.round(cw * scale), Math.round(ch * scale + CAP) * imgs.length)
  const ctx = c.getContext("2d")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.imageSmoothingEnabled = false
  imgs.forEach((img, i) => {
    const y = i * Math.round(ch * scale + CAP)
    ctx.fillStyle = "#111111"
    ctx.font = "16px sans-serif"
    ctx.fillText(captions[i], 8, y + 18)
    if (crop) {
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, y + CAP, cw * scale, ch * scale)
    } else {
      ctx.drawImage(img, 0, y + CAP, cw * scale, ch * scale)
    }
  })
  return c.toBuffer("image/png")
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const a = dirFor(LABEL)
  const b = dirFor(PRIOR)
  if (!existsSync(join(a, "manifest.json")) || !existsSync(join(b, "manifest.json"))) {
    console.error(`need both captures — run verify-hero-transition.mjs --label=${LABEL} and --label=${PRIOR} --carve=prior`)
    process.exit(1)
  }
  const mA = JSON.parse(readFileSync(join(a, "manifest.json"), "utf8"))

  const want = ["breath", "anticipation", "emerge", "land", "solid", "standup", "orbit", "hold"]
  const picks = want
    .map((ph) => {
      const rows = mA.manifest.filter((m) => m.phase === ph)
      return rows.length ? rows[Math.floor(rows.length / 2)] : null
    })
    .filter(Boolean)

  for (const [tag, dir] of [["carve", a], ["prior", b]]) {
    const files = picks.map((p) => join(dir, "scrub", String(p.i).padStart(4, "0") + ".png"))
    writeFileSync(
      join(OUT, `sheet-${tag}.png`),
      await stack(
        files,
        picks.map((p) => `${p.phase}  t=${p.t}s  carve ${(p.carve ?? 0).toFixed(2)}`),
        0.42,
      ),
    )
  }

  /* The held flat mark, both arms. The crop box is MEASURED off the frame, not
   * assumed — a hardcoded box is the class of constant this beat's tooling has
   * had wrong at least once for every constant it has. */
  const breath = mA.manifest.filter((m) => m.phase === "breath")
  const bi = breath[Math.floor(breath.length / 2)].i
  const flatA = join(a, "scrub", String(bi).padStart(4, "0") + ".png")
  const flatB = join(b, "scrub", String(bi).padStart(4, "0") + ".png")
  const img = await loadImage(flatA)
  const c0 = createCanvas(img.width, img.height)
  const x0 = c0.getContext("2d")
  x0.drawImage(img, 0, 0)
  const { data } = x0.getImageData(0, 0, img.width, img.height)
  let minX = 1e9
  let maxX = -1
  let minY = 1e9
  let maxY = -1
  const H = Math.floor(img.height * 0.75)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4
      if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] > 150) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  const crop = {
    x: Math.max(0, minX - 8),
    y: Math.max(0, minY - 12),
    w: Math.round((maxX - minX) / 2.4),
    h: maxY - minY + 24,
  }
  writeFileSync(
    join(OUT, "zoom-flat.png"),
    await stack(
      [flatA, flatB],
      ["PEN CARVE 1 — the nib's outline", "PRIOR — the tube's outline (what shipped)"],
      3,
      crop,
    ),
  )
  writeFileSync(
    join(OUT, "ab-strip.png"),
    await stack([flatA, flatB], [`pen carve — ${LABEL}`, `prior — ${PRIOR}`], 0.75),
  )

  /* ---- THE COMPARISON THE VIEWER ACTUALLY MAKES -------------------------
   * §3 K4: *"this is the frame the audience A/Bs against its memory of K1, and
   * it only works if it is the same picture."* Same framing, same camera, same
   * crop — the drawing at the breath and the object at the hold, on the DRIVEN
   * arm, with the parked arm's pair underneath for the control. If the top pair
   * does not read as two states of matter and the bottom pair does not read as
   * one, the whole lane is decoration. */
  const solidRows = mA.manifest.filter((m) => m.phase === "solid")
  if (solidRows.length) {
    const si = solidRows[Math.floor(solidRows.length / 2)].i
    const pad = (i) => String(i).padStart(4, "0") + ".png"
    writeFileSync(
      join(OUT, "k1-vs-k4.png"),
      await stack(
        [
          join(a, "scrub", pad(bi)),
          join(a, "scrub", pad(si)),
          join(b, "scrub", pad(bi)),
          join(b, "scrub", pad(si)),
        ],
        [
          "CARVE — the drawing (breath, carve 1)",
          "CARVE — the object (solid, carve 0)",
          "PRIOR — the drawing (breath)",
          "PRIOR — the object (solid)",
        ],
        3,
        crop,
      ),
    )
  }

  try {
    execFileSync(
      FFMPEG,
      [
        "-y",
        "-framerate", "12", "-i", join(a, "emerge", "%04d.png"),
        "-framerate", "12", "-i", join(b, "emerge", "%04d.png"),
        // `-2` and not `-1`: libx264 needs even dimensions and the stage is
        // 1120x841, whose half is odd. `-1` produced a zero-byte mp4 and ffmpeg
        // reported it on stderr only, which is exactly the silent-artifact class
        // this beat's tooling keeps producing.
        "-filter_complex", "[0:v]scale=560:-2[t];[1:v]scale=560:-2[u];[t][u]hstack=inputs=2",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", join(OUT, "ab-emerge.mp4"),
      ],
      { stdio: "ignore" },
    )
  } catch (e) {
    console.error("ffmpeg hstack failed:", String(e).slice(0, 200))
  }

  /* The real-time pass, trimmed out of the session recording. The offset is
   * DERIVED from the file's own duration every time — explainer 14 §8 records
   * that reusing a previous run's offset is how the artifact silently ended
   * mid-orbit and nobody noticed for a week. */
  let dur = null
  try {
    execFileSync(FFMPEG, ["-i", join(a, "play.mp4"), "-hide_banner"], {
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (e) {
    const m = String(e.stderr ?? "").match(/Duration: (\d+):(\d+):([\d.]+)/)
    if (m) dur = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
  }
  if (dur !== null) {
    /* ⚠ THE MULTIPLIER IS NOT A MARGIN, IT IS THE MEASURED FACT THAT REAL-TIME
     * PLAYBACK IS NOT REAL TIME. Explainer 14 §8: a 10.2 s timeline takes about
     * 16.6 s of wall clock on this page, so trimming `total + margin` off the end
     * lands INSIDE the beat and the artifact silently starts mid-draw. 1.7x plus
     * two seconds over-reaches deliberately: a few frames of the previous pass at
     * the head are visible and harmless, a missing beginning is not. */
    const ss = Math.max(0, dur - (mA.total * 1.7 + 2))
    execFileSync(
      FFMPEG,
      ["-y", "-ss", ss.toFixed(2), "-i", join(a, "play.mp4"),
       // The STAGE, not the whole viewport: the page's own panel and timeline
       // dock take two thirds of the frame, and a sheet in which the mark is 40
       // px wide cannot be judged for anything.
       "-vf", "crop=1120:760:0:56",
       "-c:v", "libx264", "-pix_fmt", "yuv420p", join(OUT, "realtime.mp4")],
      { stdio: "ignore" },
    )
    /* ⚠ THE SHEET'S RATE IS DERIVED FROM THE CLIP, NOT TYPED. A 5x6 tile holds
     * 30 cells; at a hardcoded 2.4 fps that is 12.5 s, and this clip is 23 s —
     * so the sheet showed the first half and stopped, with no sign that anything
     * was missing. Same class as the fixed wall-clock wait explainer 14 §8
     * records: *"a fixed wall-clock wait is an invalid instrument for anything
     * whose whole design is that it does not track the wall clock."* */
    const clip = dur - ss
    const CELLS = 30
    const fps = Math.max(0.3, CELLS / Math.max(0.5, clip))
    execFileSync(
      FFMPEG,
      ["-y", "-i", join(OUT, "realtime.mp4"),
       "-vf", `fps=${fps.toFixed(3)},scale=360:-2,tile=5x6`, "-frames:v", "1",
       join(OUT, "realtime-sheet.png")],
      { stdio: "ignore" },
    )
    console.log(
      `play.mp4 ${dur.toFixed(2)}s — real-time pass trimmed from ${ss.toFixed(2)}s ` +
        `(${clip.toFixed(2)}s), stage-cropped, sheet at ${fps.toFixed(3)} fps so ${CELLS} cells span it`,
    )
  }

  console.log(`-> ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

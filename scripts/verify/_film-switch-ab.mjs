// THE SWITCH, BEFORE AND AFTER, IN ONE FRAME, AS A FILM.
//
// `docs/DISPATCH.md` §3: *"Save video as well as frames under
// `docs/verification/`, and watch it back. Motion defects — crawl, strobing,
// judder — do not exist in a still."* Two separate films do not answer the
// question either, because the whole claim is comparative: the eye cannot hold
// a tonal level across a tab switch. So the two arms are stacked into ONE
// picture on a shared clock, from the two captures' own dense emerge windows,
// which are seek-driven and therefore immune to any stall.
//
// It also writes a contact sheet of the same pair, because a film cannot be
// quoted in a report and a sheet cannot show judder — the two artefacts answer
// different questions and this repo has shipped a bug that only one of them
// could see, in both directions.
//
// Usage: node scripts/verify/_film-switch-ab.mjs --a=pre-tone --b=lit-after
import { readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
let FFMPEG = require("ffmpeg-static")
if (!FFMPEG || !existsSync(FFMPEG)) FFMPEG = "ffmpeg"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const A = arg("a", "pre-tone")
const B = arg("b", "lit-after")
const OUT = join(ROOT, "docs", "verification", "switch-tone", "ab")
const PAIR = join(OUT, "pair")

function windowOf(label) {
  const d = join(ROOT, "docs", "verification", "hero-transition", label, "emerge")
  if (!existsSync(d)) {
    console.error(`no emerge window for "${label}" — refusing to film evidence that does not exist`)
    process.exit(1)
  }
  return d
}

async function main() {
  mkdirSync(PAIR, { recursive: true })
  const da = windowOf(A)
  const db = windowOf(B)
  const fa = readdirSync(da).filter((f) => f.endsWith(".png")).sort()
  const fb = readdirSync(db).filter((f) => f.endsWith(".png")).sort()
  const n = Math.min(fa.length, fb.length)
  if (fa.length !== fb.length) {
    console.warn(`window lengths differ (${fa.length} vs ${fb.length}) — filming the first ${n} of each`)
  }

  /* THE CROP IS THE MARK'S OWN BOX, taken from the LAST frame of the B window
   * (the settled object) and used for both arms, so the two panels are
   * comparable to the pixel and neither is re-framed by its own content. */
  const probe = await loadImage(join(db, fb[n - 1]))
  const pc = createCanvas(probe.width, probe.height)
  const px = pc.getContext("2d")
  px.drawImage(probe, 0, 0)
  const pd = px.getImageData(0, 0, probe.width, probe.height).data
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  const H0 = Math.floor(probe.height * 0.75)
  for (let y = 0; y < H0; y++)
    for (let x = 0; x < probe.width; x++) {
      const i = (y * probe.width + x) * 4
      if (0.2126 * pd[i] + 0.7152 * pd[i + 1] + 0.0722 * pd[i + 2] > 150) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  const padX = 60
  const padY = 70
  const bx = Math.max(0, minX - padX)
  const by = Math.max(0, minY - padY)
  const bw = Math.min(probe.width - bx, maxX - minX + padX * 2)
  const bh = Math.min(H0 - by, maxY - minY + padY * 2)

  const lab = 34
  const W = bw
  const Hh = bh * 2 + lab * 2
  for (let i = 0; i < n; i++) {
    const ia = await loadImage(join(da, fa[i]))
    const ib = await loadImage(join(db, fb[i]))
    const c = createCanvas(W, Hh)
    const g = c.getContext("2d")
    g.fillStyle = "#101010"
    g.fillRect(0, 0, W, Hh)
    g.drawImage(ia, bx, by, bw, bh, 0, lab, bw, bh)
    g.drawImage(ib, bx, by, bw, bh, 0, lab * 2 + bh, bw, bh)
    g.fillStyle = "#f0f0f0"
    g.font = "600 20px sans-serif"
    g.fillText(`BEFORE — ${A}`, 10, 24)
    g.fillText(`AFTER — ${B}`, 10, lab + bh + 24)
    writeFileSync(join(PAIR, String(i).padStart(4, "0") + ".png"), c.toBuffer("image/png"))
  }

  /* 12 fps, which is the beat's own twos grid — filming the comparison at a
   * rate the beat does not run at would invent judder that is not there. */
  for (const [name, fps] of [["switch-ab.mp4", 12], ["switch-ab-slow.mp4", 4]]) {
    try {
      execFileSync(
        FFMPEG,
        ["-y", "-framerate", String(fps), "-i", join(PAIR, "%04d.png"),
          "-c:v", "libx264", "-pix_fmt", "yuv420p",
          "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", join(OUT, name)],
        { stdio: "ignore" },
      )
      console.log(`wrote ${join(OUT, name)} (${n} frames at ${fps} fps)`)
    } catch (e) {
      console.warn(`ffmpeg failed for ${name}:`, e.message)
    }
  }

  /* THE CONTACT SHEET — every 6th pair, so the whole window is quotable. */
  const step = Math.max(1, Math.round(n / 12))
  const picks = []
  for (let i = 0; i < n; i += step) picks.push(i)
  const cellW = Math.round(bw / 3)
  const cellH = Math.round(bh / 3)
  const cols = picks.length
  const sheet = createCanvas(cols * cellW, cellH * 2 + lab * 2)
  const sg = sheet.getContext("2d")
  sg.fillStyle = "#101010"
  sg.fillRect(0, 0, sheet.width, sheet.height)
  for (let k = 0; k < cols; k++) {
    const ia = await loadImage(join(da, fa[picks[k]]))
    const ib = await loadImage(join(db, fb[picks[k]]))
    sg.drawImage(ia, bx, by, bw, bh, k * cellW, lab, cellW, cellH)
    sg.drawImage(ib, bx, by, bw, bh, k * cellW, lab * 2 + cellH, cellW, cellH)
    sg.fillStyle = "#f0f0f0"
    sg.font = "600 14px sans-serif"
    sg.fillText(`f${picks[k]}`, k * cellW + 4, 18)
  }
  sg.fillStyle = "#f0f0f0"
  sg.font = "600 16px sans-serif"
  sg.fillText(`BEFORE — ${A}`, 4, lab + cellH + 20)
  sg.fillText(`AFTER — ${B}`, 4, lab * 2 + cellH * 2 + 20)
  writeFileSync(join(OUT, "contact.png"), sheet.toBuffer("image/png"))
  console.log(`wrote ${join(OUT, "contact.png")}  crop x${bx} y${by} ${bw}x${bh}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

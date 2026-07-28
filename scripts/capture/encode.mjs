// Encodes the composed RGBA frame sequence into a transparent WebM
// (VP9 + yuva420p alpha). Output is 1920x1080 @ 30fps, suitable for
// overlaying in tools like Lottie Labs.
//
// Usage: node scripts/capture/encode.mjs [--out=name.webm]
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { existsSync, readdirSync } from "node:fs"

const require = createRequire(import.meta.url)
// pnpm may block ffmpeg-static's postinstall download; fall back to a system
// ffmpeg on PATH when the static binary is missing.
import { existsSync as ffmpegBinExists } from "node:fs"
let FFMPEG = require("ffmpeg-static")
if (!FFMPEG || !ffmpegBinExists(FFMPEG)) FFMPEG = "ffmpeg"

const DIR = dirname(fileURLToPath(import.meta.url))
const COMPOSED = join(DIR, "composed")
const outArg = process.argv.find((a) => a.startsWith("--out="))
const OUT = join(DIR, outArg ? outArg.split("=")[1] : "desk-doodles.webm")

if (!existsSync(COMPOSED)) {
  console.error("[encode] no composed/ directory - run compose.mjs first")
  process.exit(1)
}
const n = readdirSync(COMPOSED).filter((f) => f.endsWith(".png")).length
console.log(`[encode] encoding ${n} frames -> ${OUT}`)

execFileSync(
  FFMPEG,
  [
    "-y",
    "-framerate", "30",
    "-i", join(COMPOSED, "%04d.png"),
    "-c:v", "libvpx-vp9",
    "-pix_fmt", "yuva420p",
    "-b:v", "4M",
    "-auto-alt-ref", "0", // required for alpha with libvpx
    OUT,
  ],
  { stdio: "inherit" },
)

console.log(`[encode] done: ${OUT}`)

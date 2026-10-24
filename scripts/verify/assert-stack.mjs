// Asserts the layer stack's controls actually DO something.
//
// A control that renders identically whatever you set it to is worse than a
// missing control — it implies capability that isn't there. So each of order,
// blend and opacity must produce a measurably different image from the same
// layers, and every stack preset must differ from every other.
//
// Usage: node scripts/verify/assert-stack.mjs
//        node scripts/verify/assert-stack.mjs --label=stack-v2
// ── THE LATENT PASS-ON-NOTHING IN THE PRESET LOOP (class 1) ────────────────
//
//   `worst` initialises to `{ v: Infinity }` and is only ever lowered inside the
//   pairwise loop. With zero `preset_*.png` files that loop never runs, `worst.v`
//   stays Infinity, and `Infinity > DIFFERENT` is TRUE — so the row
//
//     PASS  stack presets / all are pairwise-distinct compositions
//
//   prints on a directory containing no presets at all, naming a closest pair of
//   "" and "". Identical shape to assert-material-craft's six skipped cells. The
//   loop is correct; the seed is a claim about evidence that does not exist.
//
//   It was provable with `--skip-presets`, which dropped the preset frames from
//   the listing without touching disk. Before that repair the flag printed the
//   PASS row above and exited 0.
//
// ── …AND NOTHING EVER PASSED THAT FLAG (repaired 2026-08-07) ───────────────
//   `--skip-presets` was the only known-bad in this file and no runner typed it,
//   so on every sweep this gate ran with nothing in the room able to say no —
//   `docs/explainers/21-losing-your-work.md` §7's rule, violated
//   (`docs/explainers/31-the-controls-that-no-sweep-ran.md` counted 19 of these
//   and this was one). The flag is DELETED, not handed to a runner: explainer 29
//   §5 argues a runner-passed flag only helps people who go through a runner,
//   and anyone typing this gate's name still gets the blind half.
//
//   `judgePresets(listing)` is the row's whole judgement, and BOTH controls
//   drive it rather than a copy of it:
//     · the SAME composition twice must be REJECTED by the same `Δ > 2.0`
//       clause. That is the one that covers `diff()` itself, which every other
//       row in this file also depends on — a metric that cannot tell a frame
//       from itself would make all nine rows meaningless, and it is the only
//       direction the real rows never exercise;
//     · a listing of 0 or 1 frames must be REFUSED rather than passing on the
//       `Infinity` seed — the defect above, run every time instead of described.
//
// ── AND `DIFFERENT` IS THIRTY-FOLD LOOSE (class 5, recorded not changed) ────
//   Measured on stack-v1: 23.42 (the closest blend pair) to 69.14, against a
//   threshold of 2.0. Nothing on this rail lives between 2 and 23. The number is
//   left where it is because a distinctness floor SHOULD be generous — the row
//   is "these are not the same image", not "these are far apart" — but it has
//   never been calibrated and is recorded here so the next reader knows that.
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { readdirSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { captureFreshness } from "./_capture-freshness.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
/* THE EVIDENCE DIRECTORY IS AN ARGUMENT, and it is one so this gate can be
 * pointed at evidence that is not there and shown to refuse. It used to be a
 * constant, which made the "does it pass on nothing?" question unaskable from
 * outside — see assert-gate-integrity.mjs channel C. */
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "stack-v1")
const DIR = join(__dirname, "..", "..", "docs", "verification", LABEL)
if (!existsSync(DIR) || !readdirSync(DIR).some((f) => f.endsWith(".png"))) {
  console.error(`no frames at ${DIR} — run verify-stack.mjs first`)
  process.exit(1)
}

async function px(f) {
  const img = await loadImage(join(DIR, f))
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return c.getContext("2d").getImageData(0, 0, img.width, img.height).data
}
function diff(a, b) {
  let sum = 0
  let n = 0
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 20 && b[i + 3] < 20) continue
    sum += (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3
    n++
  }
  return n ? sum / n : 0
}
const d = async (a, b) => diff(await px(a), await px(b))

const DIFFERENT = 2.0 // mean channel difference that counts as a visible change
let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  /* PROVENANCE — stack-v1 predates lib/style-stack.ts by ten hours and nothing
   * ever said so. See scripts/verify/_capture-freshness.mjs. */
  const fresh = captureFreshness(DIR, {
    subjects: ["lib/style-stack.ts", "lib/style-system.ts", "lib/style-shader.ts"],
    recapture: "node scripts/verify/verify-stack.mjs",
  })
  say(fresh.ok, fresh.label, fresh.detail)

  // Progressive layering: each added layer must change the image.
  const t = await d("1_none.png", "2_texture_only.png")
  const td = await d("2_texture_only.png", "3_texture_dither.png")
  const tda = await d("3_texture_dither.png", "4_all_three.png")
  say(t > DIFFERENT, "layering / texture changes the base", `Δ ${t.toFixed(2)}`)
  say(td > DIFFERENT, "layering / dither changes texture-only", `Δ ${td.toFixed(2)}`)
  say(tda > DIFFERENT, "layering / ascii changes texture+dither", `Δ ${tda.toFixed(2)}`)

  // ORDER: identical layers, swapped order, must render differently.
  const order = await d("5_order_ditherFirst.png", "6_order_asciiFirst.png")
  say(order > DIFFERENT, "stack order / dither-first differs from ascii-first", `Δ ${order.toFixed(2)}`)

  // BLEND: each mode must differ from the others.
  const nm = await d("7_blend_normal.png", "8_blend_multiply.png")
  const ns = await d("7_blend_normal.png", "9_blend_screen.png")
  const ms = await d("8_blend_multiply.png", "9_blend_screen.png")
  say(nm > DIFFERENT, "blend / normal differs from multiply", `Δ ${nm.toFixed(2)}`)
  say(ns > DIFFERENT, "blend / normal differs from screen", `Δ ${ns.toFixed(2)}`)
  say(ms > DIFFERENT, "blend / multiply differs from screen", `Δ ${ms.toFixed(2)}`)

  // OPACITY: dialing a layer down must visibly reduce it.
  const op = await d("10_opacity_full.png", "11_opacity_low.png")
  say(op > DIFFERENT, "stack opacity / dialing ASCII down changes the image", `Δ ${op.toFixed(2)}`)

  // PRESETS: every stack preset must differ from every other.
  /**
   * THE PRESET ROW'S WHOLE JUDGEMENT, in one place so the controls below grade
   * the same code the real listing does. A second implementation would be the
   * copy certifying the original.
   *
   * THE EVIDENCE HAS TO EXIST BEFORE IT CAN BE JUDGED. Two frames are the
   * minimum for a pairwise claim; below that the loop is a no-op and the
   * `Infinity` seed turns "nobody looked" into a PASS. See the header.
   */
  async function judgePresets(listing, note = "") {
    if (listing.length < 2) {
      return {
        ok: false,
        detail:
          `NOTHING GRADED — ${listing.length} preset frame(s)${note}, need at least 2 to form a pair. ` +
          `The parked seed \`worst = { v: Infinity }\` made this row PASS in exactly this situation.`,
      }
    }
    let worst = { pair: "", v: Infinity }
    for (let i = 0; i < listing.length; i++) {
      for (let j = i + 1; j < listing.length; j++) {
        const v = await d(listing[i], listing[j])
        if (v < worst.v) {
          worst = { pair: `${listing[i].replace("preset_", "").replace(".png", "")} vs ${listing[j].replace("preset_", "").replace(".png", "")}`, v }
        }
      }
    }
    return {
      ok: worst.v > DIFFERENT,
      worst,
      detail:
        `${listing.length} preset frame(s)${note}, ${(listing.length * (listing.length - 1)) / 2} pairs — ` +
        `closest: ${worst.pair} Δ ${worst.v.toFixed(2)} (floor ${DIFFERENT})`,
    }
  }

  const presets = readdirSync(DIR).filter((f) => f.startsWith("preset_")).sort()
  const real = await judgePresets(presets)
  say(real.ok, "stack presets / all are pairwise-distinct compositions", real.detail)

  /* ── THE CONTROLS · both run on the bare invocation, see the header ─────── */
  let controlFailed = 0
  const control = (ok, label, detail) => {
    if (!ok) controlFailed++
    console.log(`${ok ? "PASS" : "FAIL"}  CONTROL · ${label}${detail ? " — " + detail : ""}`)
  }

  if (presets.length >= 1) {
    const self = await judgePresets([presets[0], presets[0]], " — THE SAME FILE TWICE")
    control(
      !self.ok,
      "KNOWN-BAD — the same composition compared with ITSELF is REJECTED by that same Δ > " +
        `${DIFFERENT} clause`,
      `${self.detail}. This is the control for \`diff()\`, which EVERY row above also reads: ` +
        `the real pairs only ever exercise it in the direction that says "different", so a metric ` +
        `stuck above the floor would take all nine rows green.`,
    )
  } else {
    control(false, "the self-pair control could not run", "no preset_*.png to compare with itself")
  }
  const none = await judgePresets([], " — hidden on purpose")
  const one = await judgePresets(presets.slice(0, 1), " — hidden on purpose")
  control(
    !none.ok && !one.ok,
    "KNOWN-BAD — a listing of 0 or 1 preset frames is REFUSED, not passed on the `Infinity` seed",
    `0 frames → ${none.ok ? "PASSED (BLIND)" : "refused"} · 1 frame → ${one.ok ? "PASSED (BLIND)" : "refused"}. ` +
      `This is the defect in the header, run rather than described.`,
  )
  if (controlFailed) pass = false

  console.log(pass ? "\nALL STACK ASSERTIONS PASS" : "\nSTACK FAILURES PRESENT")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

// THE OPTION ROW, DRIVEN THROUGH THE PANEL A PERSON USES.
//
// `assert-hero-options.mjs` proves the choreography. This proves he can REACH
// it: eight pills clicked in the real DOM, on the real page, and every one of
// them provably changing the beat on the other side.
//
// WHY BOTH, AND WHY THIS ONE IS NOT OPTIONAL. `docs/DISPATCH.md` §3: *"Verify
// through the real UI, not only a harness. A whole panel once rendered zero
// controls while harness assertions passed."* A model gate cannot catch a pill
// that is not in the DOM, a pill whose click handler is not wired, a pill that
// changes state but not the timeline, or a row that overflows its column and
// clips its own last option off the edge of the panel — and the last of those
// has already happened here once.
//
// THE THING SEBS ASKED FOR IS SPECIFICALLY THE FLIPPING: *"play, flip, play
// again without a rebuild"*. So the last claim drives that literally — two
// films played end to end with a flip between them, and the geometry build
// counter read on both sides. A film that costs a geometry rebuild is a film
// he cannot A/B.
//
// Usage: node scripts/verify/assert-hero-option-panel.mjs
import { chromium } from "./lib/browser.mjs"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadTs } from "./_ts-load.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const { DEFAULT_HERO_MOTION, HERO_SHEETS, totalDuration } = loadTs("lib/hero-motion.ts")
const HERO_MOTION_SRC = readFileSync(join(ROOT, "lib", "hero-motion.ts"), "utf8")

/* ⚠ THIS LIST WAS FOUR AND THE PANEL HAD SEVEN. Nothing here failed while three
 * films went unchecked, because the rows below only ever visit the films NAMED
 * here — a gate that grades a subset it defines itself cannot notice the pills
 * it is not looking at. Found while adding O5; the two before it (`popUp`,
 * `standTurn`) had been on the panel unwatched by this instrument since they
 * landed.
 *
 * ⚠ AND IT WAS STILL A HAND-WRITTEN LIST AFTER THAT FIX — DEFECT (class 4, an
 * inventory the gate defines itself). Seven entries with seven durations typed
 * in, against a model whose `HERO_SHEETS` has seven keys. It happened to be in
 * sync, and nothing made it so: `Object.keys(HERO_SHEETS)` is one line, and
 * without it an EIGHTH film is invisible to every row in this file — no pill
 * check, no exposure sheet, no dial-visibility check — while the file prints
 * ALL PASS. That is the 4-vs-7 miss this header already records, waiting to
 * happen a second time in the same file.
 *
 * The note above said *"Durations are `totalDuration(HERO_SHEETS[shape])`,
 * computed, not copied."* They were copied. They are computed now.
 *
 * `CAMERAS` was the same shape: four ids typed here against `HeroCamera`, a
 * four-member union in `lib/hero-motion.ts`. The union is a TYPE, so it does
 * not survive to runtime and cannot be imported — it is read out of the source
 * instead, which is still the authority rather than a second copy of it. */
const FILMS = Object.keys(HERO_SHEETS).map((shape) => [
  shape,
  totalDuration({ ...DEFAULT_HERO_MOTION, beats: HERO_SHEETS[shape] }),
])

/** The `HeroCamera` union's members, read off its own declaration. */
function readCameraUnion(src) {
  const start = src.indexOf("export type HeroCamera =")
  if (start < 0) return []
  // The union runs to the first line that is neither a `| "id"` member, a
  // comment, nor blank — i.e. the next top-level declaration.
  const rest = src.slice(start + "export type HeroCamera =".length)
  const end = rest.search(/\n(?:export|const|function|type|interface|\/\*\*)/)
  return [...(end < 0 ? rest : rest.slice(0, end)).matchAll(/\|\s*"([A-Za-z0-9_]+)"/g)].map((m) => m[1])
}
const CAMERAS = readCameraUnion(HERO_MOTION_SRC)

/* ---- THE PANEL'S CONDITIONAL BLOCKS, READ OUT OF page.tsx -------------------
 *
 * Same class as `FILMS` and `CAMERAS`, three more times over: rows 4, 4b and 5
 * each carried a hand-written list or a bare literal —
 *
 *     ["rise","park","tilt","descend"]   with  moving.riseReads === 4
 *     POP / CASCADE label lists          with  === POP.length / === CASCADE.length
 *     Math.abs(back - 12.367) < 0.02
 *
 * — and every one of them is a copy of something `page.tsx` already states. A
 * fifth camera read, a third pop-up dial or a sixth cascade dial is invisible to
 * the row that claims to be counting them, and `=== POP.length` is the same
 * compare-a-literal-with-itself shape as `heldShots.length === 4` in
 * `assert-hero-ledger.mjs`: it asserts that a list typed two lines up has the
 * length it was typed with.
 *
 * They are read off the JSX conditional blocks now — by indentation, which this
 * file's formatting makes exact, rather than by counting parentheses through
 * hint strings that contain their own. */
const PAGE_LINES = readFileSync(join(ROOT, "app", "desk-doodles", "page.tsx"), "utf8").split("\n")
function jsxBlocks(marker) {
  const out = []
  for (let i = 0; i < PAGE_LINES.length; i++) {
    if (!PAGE_LINES[i].includes(marker)) continue
    const indent = PAGE_LINES[i].match(/^\s*/)[0].length
    let j = i + 1
    for (; j < PAGE_LINES.length; j++) {
      const m = PAGE_LINES[j].match(/^(\s*)\)\}/)
      if (m && m[1].length <= indent) break
    }
    out.push(PAGE_LINES.slice(i, j + 1).join("\n"))
  }
  return out
}
/** `<Dial label="…">` sites in a block — MULTI-LINE TOLERANT, because every dial
 *  in the film-conditional blocks is written across several lines. */
const dialLabelsIn = (text) =>
  [...text.matchAll(/<Dial\s[\s\S]*?label="([^"]+)"/g)].map((m) => m[1])

const CAMERA_BLOCKS = jsxBlocks('motion.camera !== "prior" ? null : (')
/** The reads that exist only while the camera moves. Four today; derived. */
const CAMERA_READS = [
  ...new Set(CAMERA_BLOCKS.flatMap((b) => [...b.matchAll(/data-read-([a-zA-Z]+)=/g)].map((m) => m[1]))),
]
const POP = dialLabelsIn(jsxBlocks('motion.shape === "popUp" && (').join("\n"))
const CASCADE = dialLabelsIn(jsxBlocks('motion.shape === "letterByLetter" && (').join("\n"))
/** The shipped sheet's own length, for row 5's round trip. */
const SHIPPED_SEC = FILMS.find(([id]) => id === "shipped")?.[1] ?? NaN

if (!CAMERAS.length || !CAMERA_READS.length || !POP.length || !CASCADE.length || !Number.isFinite(SHIPPED_SEC)) {
  // A PARSE THAT MATCHES NOTHING IS NOT AN EMPTY PANEL. Every list above is
  // derived, so an empty one means this file can no longer read its subject —
  // and an empty list makes the rows below vacuously true, which is the exact
  // failure mode this whole repair is about. Refuse rather than pass.
  console.error(
    `could not derive the panel's inventories from source — films ${FILMS.length}, cameras ` +
      `${CAMERAS.length}, camera reads ${CAMERA_READS.length}, pop dials ${POP.length}, ` +
      `cascade dials ${CASCADE.length}, shipped ${SHIPPED_SEC}. Refusing to grade a subject it cannot see.`,
  )
  process.exit(2)
}
console.log(
  `derived from source — ${FILMS.length} films (lib/hero-motion.ts HERO_SHEETS), ${CAMERAS.length} cameras ` +
    `(HeroCamera union), ${CAMERA_READS.length} camera-only reads [${CAMERA_READS.join(", ")}], ` +
    `${POP.length} pop-up dials [${POP.join(", ")}], ${CASCADE.length} cascade dials [${CASCADE.join(", ")}]\n`,
)

/* ---- CALIBRATION: A SYNTHETIC EIGHTH FILM ---------------------------------
 *
 * `--calibrate=film8` adds a film to the derived inventory that the panel does
 * not have. Every row that visits films must then go red — starting with the
 * pill row, which cannot find `[data-read-film="__ghostFilm"]` in the DOM.
 *
 * It is the mirror of the real defect: the real one is a film the PANEL has and
 * the gate does not, and there is no way to add a film to the panel from here
 * without editing `page.tsx`. A gate that notices a mismatch in one direction
 * notices it in the other — the row compares two lists — so this proves the
 * comparison happens at all, which is exactly what the typed list never did.
 * Named as the mirror rather than sold as the thing itself. */
const CALIBRATE = (process.argv.find((a) => a.startsWith("--calibrate=")) ?? "").split("=")[1] ?? ""
if (CALIBRATE === "film8") {
  FILMS.push(["__ghostFilm", 9.999])
  console.log(
    `CALIBRATION --calibrate=film8: a film the panel does not have was added to the derived\n` +
      `inventory (${FILMS.length} films now). Every row that visits films MUST go red.\n`,
  )
} else if (CALIBRATE) {
  console.error(`unknown --calibrate=${CALIBRATE} (film8)`)
  process.exit(2)
}

const rows = []
const add = (pass, name, detail) => rows.push({ pass, name, detail })

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 90000 })
  await page.waitForTimeout(4000)

  const total = () => page.locator("[data-hero-scrub]").evaluate((el) => parseFloat(el.max))
  const readFilm = () => page.locator("[data-hero-film]").getAttribute("data-hero-film")
  const readCam = () => page.locator("[data-hero-camera]").getAttribute("data-hero-camera")
  /* THE POSE, AND ONLY THE POSE.
   *
   * ⚠ THE FIRST VERSION OF THIS READ THE WHOLE READOUT LINE, WHICH CARRIES THE
   * CAMERA'S NAME — so the "four framings, four readings" row below could have
   * passed on four labels while all four cameras sat in the same place. That is
   * the green-row-that-cannot-fail shape exactly, caught by reading the output
   * rather than the score: `desk` and `cut` printed the SAME pose and the row
   * still passed. It now scrapes the three numbers and nothing else, and
   * samples at two playhead times, because `cut` IS `desk` inside its own
   * window and only separates outside it. */
  const pose = () =>
    page.evaluate(() => {
      const el = document.querySelector("[data-hero-camera]")
      const m = (el?.parentElement.textContent ?? "").match(
        /az\s*(-?[\d.]+)°\s*el\s*(-?[\d.]+)°\s*fill\s*([\d.]+)/,
      )
      return m ? `${m[1]}/${m[2]}/${m[3]}` : "UNREADABLE"
    })

  /* 1 · EVERY PILL IS ON SCREEN AND NOT CLIPPED. The row wraps precisely so it
   *     cannot lose an option off the panel's right edge; measured rather than
   *     trusted, because that is the defect the wrapping variant exists for. */
  {
    const missing = []
    const clipped = []
    for (const kind of ["film", "camera"]) {
      const ids = kind === "film" ? FILMS.map((f) => f[0]) : CAMERAS
      for (const id of ids) {
        const loc = page.locator(`[data-read-${kind}="${id}"]`)
        if ((await loc.count()) !== 1) {
          missing.push(`${kind}=${id}`)
          continue
        }
        const box = await loc.boundingBox()
        const parent = await page.locator(`[data-read-${kind}="${id}"]`).evaluate((el) => {
          const p = el.closest("[data-pill-group]").getBoundingClientRect()
          const r = el.getBoundingClientRect()
          return { over: r.right - p.right, under: p.left - r.left, w: r.width }
        })
        if (!box || box.width < 20 || parent.over > 1 || parent.under > 1) {
          clipped.push(`${kind}=${id} (${JSON.stringify(parent)})`)
        }
      }
    }
    add(
      missing.length === 0 && clipped.length === 0,
      `all ${FILMS.length + CAMERAS.length} pills are in the DOM and inside their own row`,
      missing.length || clipped.length
        ? `MISSING ${missing.join(", ")} · CLIPPED ${clipped.join(", ")}`
        : `${FILMS.length} film pills and ${CAMERAS.length} camera pills, none overflowing its group`,
    )
  }

  /* 2 · A FILM PILL WRITES THE WHOLE EXPOSURE SHEET. The state changing is not
   *     the claim — the TIMELINE moving is, because the sheet is half of what
   *     an option is. */
  {
    const bad = []
    for (const [id, want] of FILMS) {
      /* A PILL THAT IS NOT THERE IS A RED ROW, NOT AN EXCEPTION. Unguarded,
       * this line threw a 30s Playwright timeout and took the whole file down
       * before a single row was printed — so the one input this row exists to
       * catch (a film the panel does not have) produced a stack trace instead
       * of a verdict, and a stack trace is not attributable in a sweep table. */
      if ((await page.locator(`[data-read-film="${id}"]`).count()) !== 1) {
        bad.push(`${id}: NO PILL IN THE DOM`)
        continue
      }
      await page.locator(`[data-read-film="${id}"]`).click()
      await page.waitForTimeout(500)
      const got = await total()
      const shown = await readFilm()
      if (shown !== id || Math.abs(got - want) > 0.02) bad.push(`${id}: panel "${shown}" timeline ${got.toFixed(3)}s (want ${want.toFixed(3)})`)
    }
    add(bad.length === 0, "each film pill writes its own exposure sheet into the dock", bad.length ? bad.join(" · ") : FILMS.map(([i, w]) => `${i} ${w.toFixed(3)}s`).join(" · "))
  }

  /* 3 · A CAMERA PILL MOVES THE CAMERA — and the parked ones park it. Read off
   *     the panel's own live pose readout, mid-beat, where the shipped program
   *     is at its most extreme. */
  {
    await page.locator(`[data-read-film="shipped"]`).click()
    await page.waitForTimeout(500)
    // Park the playhead inside the shipped tilt, where the four-move camera is
    // 60 deg from where every parked law is.
    const seek = async (t) =>
      page.evaluate((tt) => {
        const el = document.querySelector("[data-hero-scrub]")
        const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        set.call(el, String(tt))
        el.dispatchEvent(new Event("input", { bubbles: true }))
      }, t)
    const seen = {}
    for (const id of CAMERAS) {
      await page.locator(`[data-read-camera="${id}"]`).click()
      await page.waitForTimeout(350)
      const at = []
      // Two samples: before the cut and inside the desk window. One is not
      // enough — inside its own window C-C is C-B, by construction.
      for (const t of [2.0, 8.2]) {
        await seek(t)
        await page.waitForTimeout(350)
        at.push(await pose())
      }
      seen[id] = at.join(" then ")
      if ((await readCam()) !== id) seen[id] = "PILL DID NOT TAKE: " + seen[id]
    }
    const vals = Object.values(seen)
    const distinct = new Set(vals).size
    add(
      distinct === CAMERAS.length && !vals.some((v) => v.startsWith("PILL") || v.includes("UNREADABLE")),
      `each camera pill puts the camera somewhere different — ${CAMERAS.length} framings, ${CAMERAS.length} readings`,
      `az/el/fill at t 2.0 then t 8.2 — ` +
        Object.entries(seen).map(([k, v]) => `${k} ${v}`).join(" · "),
    )
  }

  /* 4 · THE CAMERA-ONLY CONTROLS APPEAR AND DISAPPEAR WITH THE CAMERA. Names
   *     match behaviour: four reads and seven dials shape a MOVING camera, and
   *     a live-looking control that moves nothing is the defect this panel has
   *     already been swept for once. */
  {
    const count = async () =>
      page.evaluate((reads) => ({
        riseReads: reads.filter((k) => document.querySelector(`[data-read-${k}]`)).length,
        arc: [...document.querySelectorAll("span")].filter((s) =>
          ["Lying elevation", "Hold azimuth", "Hold elevation", "Held", "Drift cut", "Wind-up depth"].includes(s.textContent),
        ).length,
        desk: [...document.querySelectorAll("span")].filter((s) => s.textContent === "Desk azimuth").length,
      }), CAMERA_READS)
    await page.locator(`[data-read-camera="prior"]`).click()
    await page.waitForTimeout(400)
    const moving = await count()
    await page.locator(`[data-read-camera="desk"]`).click()
    await page.waitForTimeout(400)
    const parked = await count()
    add(
      moving.riseReads === CAMERA_READS.length && parked.riseReads === 0 && moving.desk === 0 && parked.desk === 1 && parked.arc < moving.arc,
      "the camera-only controls are shown only while there IS a camera move",
      `four moves: ${moving.riseReads}/${CAMERA_READS.length} camera reads [${CAMERA_READS.join(", ")}, read out of ` +
        `page.tsx's own camera-guarded blocks], ${moving.arc} arc/push/curve dials, ${moving.desk} desk dials · ` +
        `parked: ${parked.riseReads} camera reads, ${parked.arc} arc/push/curve dials, ${parked.desk} desk dials`,
    )
  }

  /* 4b · AND SO DO THE FILM-ONLY DIALS. Same claim, same reason: `popStandDeg`
   *      and `popStandFH` shape the pop-up's hinge and the cascade's five shape
   *      the cascade, and a slider sitting on the panel while the film it
   *      belongs to is not playing is the dead-dial class this beat has shipped
   *      three times. Counted by their own labels, because a count of "sliders"
   *      would pass on the wrong five. */
  {
    const labels = (want) =>
      page.evaluate(
        (ws) => [...document.querySelectorAll("span")].filter((s) => ws.includes(s.textContent)).length,
        want,
      )
    // POP and CASCADE are derived at the top of this file from page.tsx's own
    // film-guarded blocks — see the note there for what the typed lists were.
    const at = {}
    for (const film of ["shipped", "popUp", "letterByLetter"]) {
      await page.locator(`[data-read-film="${film}"]`).click()
      await page.waitForTimeout(500)
      at[film] = { pop: await labels(POP), cas: await labels(CASCADE) }
    }
    await page.locator(`[data-read-film="shipped"]`).click()
    await page.waitForTimeout(400)
    add(
      at.shipped.pop === 0 &&
        at.shipped.cas === 0 &&
        at.popUp.pop === POP.length &&
        at.popUp.cas === 0 &&
        at.letterByLetter.cas === CASCADE.length &&
        at.letterByLetter.pop === 0,
      "each film's own dials appear only while that film is the one playing",
      `as shipped: ${at.shipped.pop} pop-up dials, ${at.shipped.cas} cascade dials · ` +
        `pop-up: ${at.popUp.pop}/${POP.length}, ${at.popUp.cas} · ` +
        `letter by letter: ${at.letterByLetter.pop}, ${at.letterByLetter.cas}/${CASCADE.length}`,
    )
  }

  /* 5 · PLAY, FLIP, PLAY AGAIN — AND NO REBUILD. The literal ask. */
  {
    const builds = () => page.evaluate(() => window.__geomDebug.buildCount())
    const playThrough = async () => {
      await page.evaluate(() => {
        const el = document.querySelector("[data-hero-scrub]")
        const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        set.call(el, "0")
        el.dispatchEvent(new Event("input", { bubbles: true }))
      })
      await page.waitForTimeout(300)
      const end = await total()
      await page.locator("[data-hero-play]").click()
      await page
        .waitForFunction(
          (t) => parseFloat(document.querySelector("[data-hero-scrub]").value) >= t - 0.05,
          end,
          { timeout: Math.ceil(end * 1000) * 4 + 15000 },
        )
        .catch(() => {})
    }
    await page.locator(`[data-read-film="turnLands"]`).click()
    await page.waitForTimeout(500)
    const b0 = await builds()
    await playThrough()
    await page.locator(`[data-read-film="cutaway"]`).click()
    await page.waitForTimeout(600)
    await playThrough()
    await page.locator(`[data-read-film="shipped"]`).click()
    await page.waitForTimeout(600)
    await playThrough()
    const b1 = await builds()
    const back = await total()
    add(
      b1 === b0 && Math.abs(back - SHIPPED_SEC) < 0.02,
      "play, flip, play again — three films end to end, no geometry rebuild, and the shipped sheet comes back",
      `geometry builds ${b0} -> ${b1} across three full playbacks and two flips; ` +
        `the shipped sheet restores to ${back.toFixed(3)}s against the model's own ` +
        `totalDuration(HERO_SHEETS.shipped) = ${SHIPPED_SEC.toFixed(3)}s (was the literal 12.367)`,
    )
  }

  add(errors.length === 0, "console clean", errors.length ? errors.join(" | ") : "0 errors")

  await context.close()
  await browser.close()

  for (const r of rows) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}\n      ${r.detail}`)
  const failed = rows.filter((r) => !r.pass).length
  console.log(failed ? `\n${failed} FAILED` : "\nALL PASS")

  /* THE CALIBRATION RUN'S VERDICT IS INVERTED — same idiom as
   * `assert-hero-dead-channels.mjs --control=flat` and
   * `assert-hero-transition.mjs --mutate=`. With a film in the inventory that
   * the panel does not have, the film rows MUST be red; a green run here means
   * the derivation is not actually being compared against anything and the
   * 4-vs-7 miss can happen again. */
  if (CALIBRATE === "film8") {
    const filmRows = rows.filter((r) => /pills are in the DOM|exposure sheet/.test(r.name))
    const green = filmRows.filter((r) => r.pass)
    if (green.length) {
      console.error(
        `\nCALIBRATION --calibrate=film8: FAILED TO FAIL. ${green.length} film row(s) stayed green ` +
          `with an 8th film in the inventory that the panel does not have, so their green means nothing:\n` +
          green.map((r) => `  - ${r.name}`).join("\n"),
      )
      process.exit(1)
    }
    console.log(
      `\nCALIBRATION --calibrate=film8: all ${filmRows.length} film rows went RED, as required. ` +
        `The inventory is COMPARED against the panel rather than defined by this file.`,
    )
    process.exit(0)
  }

  /* ── THE CONTROL, ON THE BARE INVOCATION — this gate runs it itself ───────
   *
   * ⚠ `--calibrate=film8` HAD NEVER RUN IN A SWEEP. Nothing passes it, so the
   * one arm proving the film inventory is COMPARED against the panel rather than
   * defined by this file had never executed — `docs/explainers/21-losing-your-
   * work.md` §7's rule, and explainer 31 counted nineteen gates breaking it,
   * this among them. The 4-vs-7 miss in this file's own header is what that
   * costs.
   *
   * THE BARE RUN NOW SPAWNS ITSELF ONCE and turns the child's exit code into a
   * row. The calibration machinery is unchanged and NOT duplicated — the control
   * IS this gate, run against a deliberately wrong inventory. Re-implementing it
   * inline would put two implementations of one idea in the one place a
   * divergence is invisible: the copy would be the thing certifying the original.
   * (Lane I's `assert-hero-transition` reasoning, and `assert-gate-integrity.mjs`
   * `selfSweeps()` — landed — is what teaches channel J that a flag its own gate
   * passes on every run is swept.)
   *
   * The mutation is at MODULE scope (`FILMS.push`), so it cannot be applied
   * twice in one process; a child is not a convenience here, it is the only way
   * to run both inventories.
   *
   * ⚠ THE CHILD'S ROWS ARE NOT ECHOED. A control run makes rows red on purpose,
   * and both battery runners count an indented `FAIL`, so echoing the child
   * would post this gate's own evidence as its failures. Only its one-line
   * verdict is quoted, sanitised. */
  const { spawnSync } = await import("node:child_process")
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--calibrate=film8"], {
    encoding: "utf8",
    env: process.env,
  })
  const childOut = `${child.stdout ?? ""}${child.stderr ?? ""}`
  const verdictLine =
    childOut
      .split("\n")
      .filter((l) => /^CALIBRATION --calibrate=film8:/.test(l.trim()))
      .pop() ?? "(no verdict line — the child did not reach its calibration block)"
  const controlOk = child.status === 0
  console.log(
    `${controlOk ? "PASS" : "FAIL"}  CONTROL · KNOWN-BAD — an EIGHTH film the panel does not have is ` +
      `REJECTED by every row that visits films`,
  )
  console.log(
    `      child exit ${child.status} (needs 0) · ${verdictLine.trim().replace(/\s+/g, " ").slice(0, 240)}` +
      `${controlOk ? "" : "\n      THE FILM INVENTORY IS NOT BEING COMPARED AGAINST THE PANEL — the 4-vs-7 miss can happen again"}`,
  )

  process.exit(failed || !controlOk ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

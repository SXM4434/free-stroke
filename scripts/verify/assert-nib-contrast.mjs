/**
 * DOES THE SOLID'S WIDTH DEPEND ON DIRECTION? — the nib gate, BOTH FAMILIES.
 *
 * N6, 2026-08-28. Sebs: *"the way it writes in is ass still"*. The diagnosis
 * behind this gate is that the flat half of the hero beat has carried a broad
 * nib since `lib/flat-ink.ts` shipped `nibHalfWidth`, and the solid half swept a
 * round pen — one radius for the whole word, which renders as tubing.
 * `docs/research/stroke-width-models.md` §1.1 is the law:
 *
 *     h(psi) = sqrt( a^2 sin^2 psi + b^2 cos^2 psi ),   psi = theta - alpha
 *
 * and its §1.1 note that *"the contrast ratio a nib produces is exactly a/b"*.
 *
 * ── N8, THE SAME NIGHT: THIS GATE COULD ONLY SEE HALF THE APP ─────────────
 *
 * It measured `GE.getEngine("inflate")` — Free Stroke's engine, by name — and
 * so it went 13/13 green on the night `desk-doodles` was still a monoline.
 * `docs/RUN-QUEUE.md` F34: the same film, before and after, returned
 * BYTE-IDENTICAL numbers for that family, 28 131 ink and the same seven
 * counters, because `lib/dd-engine/adapter.ts` never read `inflateParams`.
 *
 * ⚠ AND THE FAMILY IT COULD NOT SEE IS THE ONE HE NAMED: *"**the desk doodles**
 * like its all kind of crappy and the way it writes in is ass still."* A gate
 * addressed to one surface by NAME cannot report on the surface the complaint is
 * about. Every row below now runs on both, through `getEngineFor` — the app's
 * own header switch — and the gate fails if either family fails.
 *
 * ── WHAT IT MEASURES, AND WHY IT IS PIXELS AND NOT THE FORMULA ────────────
 * `INFLATE_DEBUG.nibContrastBuilt` already reports `max/min h` over the word's
 * own direction census — but it is computed FROM the formula, so it would read
 * 1.80 for a nib that never reached a single vertex. This gate builds the real
 * mesh, rasterises its XY silhouette, and walks the centreline measuring the
 * ink's half-width perpendicular to travel. It is a claim about the SURFACE.
 *
 * ── THE FIVE KNOWN-BADS, ALL RUN ON THE DEFAULT INVOCATION ────────────────
 * `docs/explainers/21-losing-your-work.md` §7 requires a control on the plain
 * run, and DISPATCH §2.6: *"Calibrate the instrument against a known-bad input
 * and require it to fail. Ten instruments in this repo have reported green while
 * measuring nothing."*
 *
 *   SUBJECT   the shipped nib.
 *   mono      aspect 1.0 — a round pen. **This is the state that shipped until
 *             the night this was written**, and on `desk-doodles` it is
 *             literally the geometry the pre-F34 adapter produced, so the
 *             control is the defect rather than a drawing of it.
 *             The contrast row must go RED.
 *   mirror    the nib angle negated. The canvas→world y-flip in
 *             `inflateResolveNib` is one sign, and getting it wrong mirrors the
 *             solid's pen against the flat register's — two pens in one beat,
 *             which renders as "the solid is a different hand" and reads as a
 *             taste problem rather than a bug. The fitted-angle row must go RED.
 *   doubled   `A` applied twice, which is the defect this change actually shipped
 *             on its first browser run: the word came back rotated 12° and
 *             stretched (`docs/verification/nib-2026-08-28/after-doubled/`). The
 *             baseline-axis row must go RED.
 *   docPick   aspect 5, the research doc's own ranked pick. Counter row RED.
 *   johnston  angle 0°, Johnston 1906's own pen angle. Per-counter row RED.
 *
 * A sixth guard is not an arm but a POSITIVE CONTROL on the instrument itself:
 * the centreline must lie inside the ink mask at ≥99 % of samples. An instrument
 * whose ruler has slipped off the subject can report any number it likes.
 */
import { GE, FAMILIES, arm, MIN_COUNTER, worstCounterRatio, ARC_BAND } from "./_nib-measure.mjs"

/* THE FLOOR, and it is derived rather than picked. The nib ships at aspect 1.8;
 * a raster measurement of it loses contrast at both ends — the thickest bins are
 * clipped by the crossing filter, the thinnest by the one-texel quantisation —
 * so the gate asks for 70 % of the requested ratio and no more. What it is
 * really separating is 1.0 from 1.8, and the `mono` arm proves it can, in both
 * families: free stroke 1.203 against 1.784, desk doodles 1.163 against 1.780. */
const CONTRAST_FLOOR = 1 + (GE.INFLATE_NIB_ASPECT_DEFAULT - 1) * 0.7
/** The nib's own angle, world convention, mod 180 — where the hairline lives. */
const EXPECT_THIN_WORLD = ((-GE.INFLATE_NIB_ANGLE_DEG_DEFAULT % 180) + 180) % 180
const ANGLE_TOL = 20

/**
 * COUNTER AREA — the legibility row, and it is here because the nib's real risk
 * is not that it does nothing, it is that it does too much.
 *
 * A counter is the enclosed background inside a letter: the `e`'s eye, the `o`'s
 * ring, the `D`'s bowl. Measured on this word's own solid silhouette, aspect
 * 5:1 — **the number `docs/research/stroke-width-models.md` ranked item 1
 * recommends** — closes four of the seven and takes the enclosed area from
 * 99 926 texels to 68 088. The sheet is
 * `docs/verification/nib-2026-08-28/sweep/SHEET-aspect-full.png` and at 5:1
 * "Doodles" reads as one black mass.
 *
 * The bar is a RETAINED FRACTION rather than a count, because at this raster the
 * count flickers as a small counter crosses `MIN_COUNTER` (7 / 7 / 6 / 6 / 7
 * across aspects 1.0 → 3.0). Area does not flicker, and area is what "the letter
 * is still open" actually means.
 */
const COUNTER_RETAIN_MIN = 0.9
/**
 * …AND THE SAME QUESTION PER LETTER, because the total cannot see one eye going
 * out. A counter that shuts gives its pixels to the ones that survive, so the
 * total can hold while a letter closes. Matched by centroid against the round
 * pen's own counters; 0.25 means no single counter may lose three quarters of
 * itself. `nibAngleDeg: 0` — Johnston's own angle — scores **0.011** here, which
 * is the `o` at x≈876 dropping from 1 968 texels to 21.
 */
const COUNTER_WORST_MIN = 0.25

const rows = []
const say = (key, ok, label, detail) => {
  rows.push({ key, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}
const check = (a, mono) => ({
  instrument: a.insideFrac >= 0.99 && a.samples >= 200,
  contrast: a.contrast >= CONTRAST_FLOOR,
  angle:
    Math.min(
      Math.abs(a.fittedAngleWorldDeg - EXPECT_THIN_WORLD),
      180 - Math.abs(a.fittedAngleWorldDeg - EXPECT_THIN_WORLD),
    ) <= ANGLE_TOL,
  counters: a.counterTotal / mono.counterTotal >= COUNTER_RETAIN_MIN,
  counterWorst: worstCounterRatio(mono.regions, a.regions).worst >= COUNTER_WORST_MIN,
  weight: a.ink / mono.ink >= 0.92 && a.ink / mono.ink <= 1.15,
  axis: Math.abs(a.axisDeg - mono.axisDeg) <= 3,
})

/* THE SHIPPED DIAL IS RATCHETED, BECAUSE EVERY OTHER ROW MOVES WITH IT.
 *
 * Found by a Codex crosscheck, 2026-08-28, and confirmed at the line: aspect
 * 1.8 -> 1.6 returns 30/30 exit 0, and angle 30 -> 20 returns 30/30 exit 0.
 * `CONTRAST_FLOOR` at :71 and `EXPECT_THIN_WORLD` at :73 both DERIVE from the
 * constants under test, so the bar moves with the defect and this gate can never
 * notice the dial changed.
 *
 * That derivation is not a mistake. The rows below prove the MESH TRACKS THE
 * DIAL, which is a real claim and the one they were written for. What was
 * missing is that nothing guarded the dial's SHIPPED VALUE.
 *
 * It is guardable now because it stopped being a preference. Lane N21 bisected
 * it: at 2.0 mode-rims goes 8 red to 10, non-manifold edges 14 to 24, and a
 * desk-doodles counter closes to 21.5 % of itself; at 2.4 two of free stroke's
 * seven counters close outright and BLEND-2 reads 0.02696 against its 0.03 bar,
 * so the seam blend control goes blind. 1.8 is the last setting where this gate
 * is 30/30.
 *
 * So this row does not judge the mark. It says the measured decision is still
 * the shipped one, and it is the only row here that a changed default trips. */
const SHIPPED_ASPECT = 1.8
const SHIPPED_ANGLE_DEG = 30
say(
  "shipped-dial",
  GE.INFLATE_NIB_ASPECT_DEFAULT === SHIPPED_ASPECT && GE.INFLATE_NIB_ANGLE_DEG_DEFAULT === SHIPPED_ANGLE_DEG,
  `the SHIPPED dial is still the measured one — aspect ${SHIPPED_ASPECT}, angle ${SHIPPED_ANGLE_DEG}°`,
  `aspect ${GE.INFLATE_NIB_ASPECT_DEFAULT}, angle ${GE.INFLATE_NIB_ANGLE_DEG_DEFAULT}°` +
    (GE.INFLATE_NIB_ASPECT_DEFAULT === SHIPPED_ASPECT && GE.INFLATE_NIB_ANGLE_DEG_DEFAULT === SHIPPED_ANGLE_DEG
      ? ""
      : " — EVERY OTHER ROW IN THIS GATE DERIVES FROM THESE, so they moved with it and cannot tell you"),
)

console.log(`\n=== THE NIB: DOES THE SOLID'S WIDTH DEPEND ON DIRECTION? ===`)
console.log(
  `families: ${FAMILIES.join(", ")}  ·  direction census over arc band ${ARC_BAND[0]}–${ARC_BAND[1]}\n`,
)

for (const family of FAMILIES) {
  const F = (k) => `${family}/${k}`
  const subject = arm({}, false, family)
  const mono = arm({ nibAspect: 1 }, false, family)
  const mirror = arm({ nibAngleDeg: -GE.INFLATE_NIB_ANGLE_DEG_DEFAULT }, false, family)
  const doubled = arm({}, true, family)
  /* THE FOURTH KNOWN-BAD, and the most useful one, because it is not a mistake —
   * it is a CITED, plausible setting. A gate whose controls are all obvious typos
   * has never been asked the question that gets a build shipped. */
  const docPick = arm({ nibAspect: 5 }, false, family)
  /* THE FIFTH, and it is the other half of the same argument. Johnston 1906
   * specifies a 0° pen angle and `stroke-width-models.md` §1.3 quotes him at
   * length; §1.4's own census then measures 16.7 % of THIS word's travel going
   * hairline at 0° against 9.5 % at 30°, and ranked item 1 concludes *"Default to
   * 30° for the logo … but the 0° preset is the historically-primary one and
   * should be one click away, not absent."* This arm is what makes that a
   * measurement rather than a preference: 0° is one dial click away and it shuts a
   * counter on this hand. */
  const johnston = arm({ nibAngleDeg: 0 }, false, family)

  const S = check(subject, mono)

  console.log(`\n──────── ${family} ────────`)
  console.log(
    `dial: aspect ${subject.nib.aspect} · angle ${subject.nib.angleDeg}° · weight ${subject.nib.weight}` +
      `  →  semi-axes a ${subject.nib.a.toFixed(4)} R, b ${subject.nib.b.toFixed(4)} R`,
  )
  if (family === "free-stroke") {
    console.log(
      `formula (INFLATE_DEBUG): contrast ${subject.dbg.nibContrastBuilt.toFixed(3)} · mean width ${subject.dbg.nibMeanWidth.toFixed(3)} R`,
    )
  }
  console.log("")

  say(F("instrument"), S.instrument,
    "the ruler is on the subject — centreline inside the ink, enough samples",
    `${(subject.insideFrac * 100).toFixed(2)} % inside, ${subject.samples} samples`)

  say(F("contrast"), S.contrast,
    `the mesh's half-width VARIES with direction (floor ${CONTRAST_FLOOR.toFixed(2)}:1)`,
    `measured ${subject.contrast.toFixed(3)} : 1 — ${subject.lo.toFixed(3)} R thinnest to ${subject.hi.toFixed(3)} R thickest`)

  say(F("angle"), S.angle,
    `the fitted pen angle is the requested one (${EXPECT_THIN_WORLD}° world, ±${ANGLE_TOL}°)`,
    `fitted ${subject.fittedAngleWorldDeg}°`)

  say(F("counters"), S.counters,
    `the letters stayed open (counter area ≥ ${(COUNTER_RETAIN_MIN * 100).toFixed(0)} % of the round pen's)`,
    `${(subject.counterTotal / mono.counterTotal * 100).toFixed(1)} % — ${subject.counterTotal} px in ${subject.counters.length} counters, against ${mono.counterTotal} in ${mono.counters.length}`)

  {
    const w = worstCounterRatio(mono.regions, subject.regions)
    say(F("counterWorst"), S.counterWorst,
      `no SINGLE counter lost more than ${((1 - COUNTER_WORST_MIN) * 100).toFixed(0)} % of itself`,
      `worst ${(w.worst * 100).toFixed(1)} % at x≈${w.at.x} (${w.at.was} → ${w.at.now} texels); ` +
        `${mono.regions.length} enclosed regions before, ${subject.regions.length} after, at an 8-texel floor`)
  }

  say(F("weight"), S.weight,
    "the word kept its ink weight (0.92–1.15 of the round pen)",
    `${(subject.ink / mono.ink).toFixed(4)}× — ${subject.ink} px against ${mono.ink}`)

  say(F("axis"), S.axis,
    "the word did not rotate — the centreline round trip is exact",
    `principal axis ${subject.axisDeg.toFixed(3)}° against ${mono.axisDeg.toFixed(3)}°`)

  /* ---- THE KNOWN-BADS, AS A COVERAGE MATRIX ---------------------------
   *
   * N8, and this replaced five hand-paired assertions for a reason worth
   * stating. N6 wrote "`mono` must turn the CONTRAST row red, `johnston` must
   * turn the PER-COUNTER row red", and on Free Stroke both are true. Run the
   * same pairing on `desk-doodles` and `johnston` keeps **70.0 %** of its worst
   * counter instead of 1.1 %, because that engine fuses nothing — every stroke
   * is its own mesh, so a 0° pen thins the horizontals without ever closing an
   * eye. The pairing was a fact about ONE engine written down as a law.
   *
   * ⚠ AND THE WRONG FIX IS OBVIOUS AND AVAILABLE: exempt the row on that family
   * and take the green. That leaves `desk-doodles/counterWorst` asserting on
   * every future build with nothing on record that it can ever say no — the 53rd
   * dead gate, on the family Sebs named.
   *
   * So the contract is the one DISPATCH §2.6 actually states, per row rather
   * than per arm: **every row this gate asserts must be turned RED by at least
   * one of the arms, in THIS family.** Which arm does it is evidence, not law,
   * and the matrix below prints it. Five arms cover all seven rows in both
   * families and no arm was added to make that true — the coverage was measured
   * first and is printed every run.
   */
  const kb = [
    ["mono", mono, "aspect 1.0, the round pen that shipped — on desk-doodles, literally the geometry the pre-F34 adapter produced"],
    ["mirror", mirror, "the nib angle negated"],
    ["doubled", doubled, "`A` applied twice — the defect N6's first browser run shipped"],
    ["docPick", docPick, "aspect 5, `stroke-width-models.md`'s own ranked pick"],
    ["johnston", johnston, "`nibAngleDeg: 0`, Johnston 1906's own pen angle"],
  ]
  const ROWS = ["instrument", "contrast", "angle", "counters", "counterWorst", "weight", "axis"]
  const verdicts = kb.map(([n, a]) => [n, check(a, mono)])

  console.log(`\n--- ${family}: known-bad arms, and which row each one turns RED ---`)
  console.log("  " + "arm".padEnd(10) + ROWS.map((r) => r.slice(0, 9).padStart(14)).join(""))
  for (const [n, c] of verdicts) {
    console.log("  " + n.padEnd(10) + ROWS.map((r) => (c[r] ? "·" : "RED").padStart(14)).join(""))
  }
  console.log(
    `  numbers: ` +
      kb
        .map(([n, a]) =>
          `${n} contrast ${Number.isFinite(a.contrast) ? a.contrast.toFixed(2) : "n/a"}` +
          ` angle ${a.fittedAngleWorldDeg}°` +
          ` counters ${(a.counterTotal / mono.counterTotal * 100).toFixed(1)}%` +
          ` worstCounter ${(worstCounterRatio(mono.regions, a.regions).worst * 100).toFixed(1)}%` +
          ` ink ${(a.ink / mono.ink).toFixed(3)}×` +
          ` axis ${a.axisDeg.toFixed(2)}°`,
        )
        .join("\n           "),
  )

  for (const r of ROWS) {
    const reds = verdicts.filter(([, c]) => !c[r]).map(([n]) => n)
    say(F(`kb-${r}`), reds.length > 0,
      `the \`${r}\` row HAS a control that turns it red on this family`,
      reds.length ? `red under ${reds.join(", ")}` : "NO ARM TURNS IT RED — this row cannot say no")
  }

  say(F("kb-mono-instrument"), check(mono, mono).instrument,
    "…and the instrument still reads the round pen correctly, so a red row is the SUBJECT and not the ruler",
    `${(mono.insideFrac * 100).toFixed(2)} % inside, ${mono.samples} samples`)

  console.log(`\n${family}: per-direction median half-width, in stroke radii (world degrees, mod 180):`)
  for (const b of subject.bins) {
    const mb = mono.bins.find((x) => x.degWorld === b.degWorld)
    console.log(
      `  ${String(b.degWorld).padStart(3)}°  n=${String(b.n).padStart(4)}  nib ${b.median.toFixed(3)}  ` +
        `round ${mb ? mb.median.toFixed(3) : "  -  "}`,
    )
  }
}

const failed = rows.filter((r) => !r.ok)
console.log(
  `\n${failed.length === 0 ? "BOTH FAMILIES ARE WRITTEN WITH A NIB" : "NIB GATE FAILED"} — ` +
    `${rows.length - failed.length}/${rows.length} rows${failed.length ? ": " + failed.map((f) => f.key).join(", ") : ""}`,
)
process.exit(failed.length === 0 ? 0 : 1)

/* One saved session exercises every fusion field and draw-in extra in both Node gates. */
const FUSION = {
  fusionPreset: "terminalGel",
  fusionDrive: "arc",
  fusionAnimationEnabled: true,
  fusionAnimationSpeed: 1.3,
  fusionIntensity: 0.4,
  fusionSwing: 0.6,
  fusionChaos: 0.35,
  fusionRevealInfluence: 0.3,
  fusionCompletion: "bloom",
  fusionTipShimmer: 0.5,
  fusionPauseHold: "surface",
}
const EXTRAS = { tipHighlight: 0.4, pressureReveal: 0.5, durationSeconds: 2.5, timing: "recorded" }
const FUSION_UNIONS = new Set(["fusionPreset", "fusionDrive", "fusionCompletion", "fusionPauseHold"])

export function savedDocResult(D) {
  const clone = (v) => JSON.parse(JSON.stringify(v))
  const base = clone(D.defaultSession())
  const saved = clone(base)
  Object.assign(saved.styleState, FUSION)
  Object.assign(saved.revealEnvelope, EXTRAS)
  const bad = []
  const valid = D.validateSession(clone(saved))
  if (!valid) return { ok: false, detail: "valid saved session was refused" }
  for (const [key, value] of Object.entries(FUSION)) {
    if (!Object.is(valid.session.styleState[key], value)) bad.push(`${key} did not round-trip`)
  }
  for (const [key, value] of Object.entries(EXTRAS)) {
    if (!Object.is(valid.session.revealEnvelope[key], value)) bad.push(`${key} did not round-trip`)
  }
  if (valid.repairs.length) bad.push(`valid document repaired: ${valid.repairs.join("; ")}`)

  let invalids = 0
  for (const [section, fields] of [["styleState", FUSION], ["revealEnvelope", EXTRAS]]) {
    for (const [key, value] of Object.entries(fields)) {
      const variants = [typeof value === "number" ? "broken" : typeof value === "boolean" ? 7 : 7]
      if (FUSION_UNIONS.has(key) || key === "timing") variants.push("banana")
      for (const invalid of variants) {
        const doc = clone(saved)
        doc[section][key] = invalid
        const got = D.validateSession(doc)
        invalids++
        if (!got || !Object.is(got.session[section][key], base[section][key]) || !got.repairs.some((r) => r.includes(key))) {
          bad.push(`${key}=${JSON.stringify(invalid)} was not repaired and named`)
        }
      }
    }
  }
  return { ok: bad.length === 0, detail: bad.join("; ") || `15 valid values unchanged, ${invalids} invalid values repaired and named` }
}

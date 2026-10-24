// R1 probe — the shipped hand's Sigma-Lognormal parameters, and what they imply
// for submovement duration and overlap. Research only.
import { loadTs } from "../../../../scripts/verify/_ts-load.mjs"
const K = loadTs("lib/pen-kinematics.ts")
const h = K.drawHandState ? K.drawHandState(undefined) : null
console.log("hand state:", JSON.stringify(h, null, 2))
if (h) {
  const mu = h.mu, s = h.sigma
  const T = 2 * Math.exp(mu) * Math.sinh(3 * s)
  const inter = T * h.overlap * (h.t0Scale ?? 1)
  console.log(`\nT   = 2 e^mu sinh(3 sigma) = ${(T*1000).toFixed(1)} ms   (one submovement's active span)`)
  console.log(`K_t = T * overlap * t0Scale = ${(inter*1000).toFixed(1)} ms   (spacing between submovement onsets)`)
  console.log(`overlap ratio K_t / T       = ${(inter/T).toFixed(3)}   (research doc wants dt ~ 0.5)`)
  console.log(`onset  e^(mu-3s) = ${(Math.exp(mu-3*s)*1000).toFixed(1)} ms   tail e^(mu+3s) = ${(Math.exp(mu+3*s)*1000).toFixed(1)} ms`)
  console.log(`\nresearch doc admissible ranges: mu -2.2..-1.6, sigma 0.1..0.45`)
  console.log(`  this hand: mu ${mu.toFixed(3)} ${mu>=-2.2&&mu<=-1.6?"IN":"OUT OF"} range; sigma ${s.toFixed(3)} ${s>=0.1&&s<=0.45?"IN":"OUT OF"} range`)
}

# Synthesising natural handwriting variability

*Why our strokes read as "a machine wrote this", and what the literature says to
do about it. Sourced from primary papers, not summaries.*

---

## The bottom line

Implement the **weighted Sigma-Lognormal (ωΣΛ) model in closed form**. It is
about forty lines, needs no numerical integration, no ODE solver and no
training, and it produces geometry and kinematics from one representation.
Perturb its parameters using the published admissible ranges. That captures the
large majority of what reads as human.

Do **not** train an RNN for this, and do **not** add per-vertex Gaussian noise to
a stored polyline. The second is the most common failure and it reads as damage,
not as handwriting.

---

## 1. The single most important finding

From Lai & Jin, *SynSig2Vec* (AAAI 2020), describing how the perturbation
variables are applied:

> R_D, R_t0, R_mu, R_sigma, R_theta_s, R_theta_e are uniform random variables
> that decide the signature distortion level, and are **fixed for all strokes
> across a component**.

**The perturbation is one draw per rendering, shared by every stroke — not
independent per stroke.** A hand is in one state for the whole word: one
posture, one speed, one ink flow, one mood. Independent per-stroke jitter is
precisely what makes synthetic handwriting look wrong, because the variation has
no shared cause.

This is structural, costs nothing, and is the difference between "handwriting"
and "noise". Implement it as one RNG seed per rendered instance → one draw of
the perturbation tuple → applied to every stroke in that instance.

The corollary, from the 2025 handwriting-synthesis survey, is that **regularity
is the tell, not irregularity**: what gives synthetic work away is "exaggerated
regularities in character-shapes and probable inconsistencies in inking".

---

## 2. The model

### Speed profile

Each stroke is a lognormal velocity impulse:

```
v_j(t) = D_j / (sigma_j * sqrt(2*pi) * (t - t0_j))
         * exp( -[ln(t - t0_j) - mu_j]^2 / (2 * sigma_j^2) )
```

`D_j` is the amplitude of the command — the distance the stroke intends to
cover. `t0_j` is when the command occurs. `mu_j` is the stroke's log time delay
and `sigma_j` its log response time.

### Angular part

```
phi_i(t) = theta_s_i + ((theta_e_i - theta_s_i) / 2)
                     * [ 1 + erf( (ln(t - t0_i) - mu_i) / (sigma_i * sqrt(2)) ) ]
```

The bracketed term is the normalised weight `w_i(t) ∈ [0,1]`, which is the
lognormal's own CDF. No integration is needed — `erf` is in every standard
library.

### The closed form to actually implement

Given a start point `p0` and virtual targets `p_1..p_m`, for each stroke *i*
between `p_{i-1}` and `p_i`: `D_i = |p_i − p_{i-1}|`, `theta_i` is the direction
of that vector, and `delta_i` is the central angle of the circular arc — the
only shape knob.

```
theta0_i = theta_i + (pi + delta_i) / 2

if |delta_i| > 1e-10:
  d_i(t) = D_i * [ (cos(theta0_i - delta_i * w_i(t)) - cos(theta0_i)) / (2*sin(delta_i/2)),
                   (sin(theta0_i - delta_i * w_i(t)) - sin(theta0_i)) / (2*sin(delta_i/2)) ]
else:
  d_i(t) = D_i * [ cos(theta_i) * w_i(t),  sin(theta_i) * w_i(t) ]

p(t) = p0 + SUM_i d_i(t)
```

That is the whole renderer. Sample `t` on a uniform grid, get points, stroke
them.

### The author-facing parameters

Raw `(t0, mu, sigma)` are unusable by hand. Reparameterise to stroke **duration**
`T`, **overlap** `Δt`, and **skew** `Ac ∈ (0,1)`:

```
sigma_i = sqrt( -ln(1 - Ac_i) )
mu_i    = ln(T_i) - ln( 2 * sinh(3*sigma_i) )
t0_i    = t1_i - exp(mu_i - 3*sigma_i)
t1_i    = t1_{i-1} + T_{i-1} * Δt_i
```

The `mu` form above is algebraically identical to the published one and makes
the useful fact obvious: the lognormal's effective support is
`t − t0 ∈ [e^{mu−3σ}, e^{mu+3σ}]`, of width `T = 2·e^mu·sinh(3σ)`.

---

## 3. The numbers that matter

### Where real human movement actually lives

From Djioua & Plamondon's parameter-extraction report, Table 1, ranges fixed
from typical features of rapid movements:

| parameter | min | max |
|---|---|---|
| `t0` (s) | 0.05 | 1.0 |
| `mu` | **−2.2** | **−1.6** |
| `sigma` | **0.1** | **0.45** |

Movement time is typically **100–500 ms**, with the velocity peak about **100 ms**
after `t0`. The 50 ms floor on `t0` exists because a human does not respond to a
stimulus faster than that.

Sanity check: `mu = −1.9, sigma = 0.25` gives onset 71 ms, peak 141 ms, end
317 ms — a 246 ms stroke, squarely inside that envelope.

**`mu` and `t0` trade off directly.** Only the triple `(t0, mu, sigma)` is
meaningful, so never port a `mu` value between papers without porting its `t0`
convention too.

Converting the skew knob: `Ac` of 0.01 / 0.06 / 0.18 corresponds to `sigma` of
0.10 / 0.25 / 0.45. Real handwriting therefore lives at **Ac ≈ 0.01–0.18** —
only mildly skewed, near-Gaussian bells. Above about 0.25 is not human.

### How much to perturb

From SynSig2Vec, whose ranges come from a **visual Turing test** establishing
the point at which a character stops being recognisable:

| param | low | high |
|---|---|---|
| `D` | −10% | +10% |
| `t0` | −8.25% | +8.5% |
| `mu` | −39.5% | +37.75% |
| `sigma` | −32.5% | +28.75% |

Applied multiplicatively for scalars and **additively for angles**. Two
calibrated levels are defined: **G1**, "the same person on another day", takes
about a quarter of those ranges; **G2**, "a different person", takes roughly half
to two-thirds.

**Concrete G1 values for redrawing the same glyph**: `D ±2.5%`, `t0 ±2.1%`,
`mu ±6.7%`, `sigma ±7.5%`, angles `±0.1 rad` (±5.7°).

### The parameter that destroys the look

From Carmona-Duarte et al., *Temporal Evolution in Synthetic Handwriting* —
valuable because it states, for each knob, the value at which the letter breaks:

| knob | good | failure |
|---|---|---|
| `K_t` inter-stroke time | **0.04 s** | **0.06 s** — superposition lost |
| `eps_t` timing jitter | ±0.02 child-like, 0 adult | higher wrecks proportions |
| `eps_D` target error | 0.3 | 1.0 — unreadable |
| `K_sigma` roundness | 0 child → 0.04 adult | — |

Their sentence on `K_t` is the mechanical explanation of the whole problem:

> if the values of K_t becomes bigger than the time the lognormal is active, the
> superposition of the strokes is lost and the complete movement becomes a
> sequence of straight, independent movements.

**That is what our geometry currently is** — a sequence of straight independent
movements with fittings at the joins. Stroke overlap is the fix, and it has a
named breaking point.

---

## 4. Things you get for free, and shouldn't build

**Endpoint undershoot.** In ΣΛ the trajectory does not interpolate its own
control points:

> the trajectory does not strictly interpolate the key points, but the proximity
> of a curvature extrema to a key point varies depending on the trajectory
> smoothness in that region.

That curvature-dependent undershoot *is* the pen-doesn't-stop-exactly-at-the-
endpoint effect, and it is controlled by the single overlap parameter Δt. A
hand-rolled constant overshoot would read as a repeated tic instead.

**The speed–curvature coupling** (the "2/3 power law", `v = K·κ^(−1/3)`) emerges
from ΣΛ rather than needing to be imposed. Implementing it on top would
double-count — and the law itself is contested, with documented breakdown as
movement size and speed increase, and its constant `K` unspecified in the
literature.

---

## 5. The contextual-variation trick

Graves observed that even with sampling variance driven to zero, repeated
letters still differ — because the predictions remain influenced by previous
output. The variability that survives at zero noise is **contextual, not
stochastic**.

That is reproducible cheaply and deterministically: seed the per-instance RNG
with `hash(glyph_id, index_in_word, previous_glyph)`. Variation becomes
repeatable — same text renders identically, which matters for diffing, caching
and tests — while never visibly repeating within a word.

The type industry arrived at the same insight from the other direction. The
OpenType `rand` feature is effectively dead ("not actually random but cyclical",
and no shipping application supports it as specified), so handwriting fonts use
contextual alternates instead, chaining substitutions until an illusion of
randomness appears. Their hard-won rule: **avoid adjacent repeats.** Two
identical instances of a glyph near each other is what the eye actually catches.

---

## 6. Ranked: what carries human-ness

1. **Correlated whole-instance perturbation, not per-stroke noise.** Strongest
   evidence, free to implement, biggest effect.
2. **Stroke overlap / co-articulation** (Δt ≈ 0.5, `K_t` ≤ 0.04 s). The most
   visually consequential single parameter, with a named breaking point.
3. **Curvature–velocity coupling** — free from ΣΛ, do not add separately.
4. **Endpoint undershoot** — also free, also do not add separately.
5. **σ as the maturity/roundness axis** — changes shape without touching the
   velocity profile. A clean orthogonal knob.
6. **Virtual-target topology churn** — adding or dropping 0–5% of target points
   per instance. This changes *how many* strokes compose the glyph, which is the
   difference between "a different execution" and "the same execution jittered".
7. **Global affine** — rotation σ ≈ 1.8°, translation up to 2% of glyph size.
   Small. Large slant jitter reads as drunk, not human.
8. **Amplitude and direction** — ±2.5% and ±0.1 rad at the same-person level.
9. **Elastic raster warp** — weakest, kinematics-blind, distorts stroke width.
   A fallback, not a mechanism.

---

## 7. What not to do

- **Train an RNN.** Wrong shape for "vary a known glyph" — its value is
  generating *unknown* glyphs, which we don't need. Steal only its temperature
  concept: one scalar dial scaling every perturbation magnitude at once, so the
  author trades legibility against liveliness with one slider. The ΣΛ literature
  converged on the same idea independently.
- **Per-vertex Gaussian noise on a stored polyline.** The most common mistake.
  Violates the correlated-perturbation finding, produces no kinematic structure,
  reads as damage.
- **Per-stroke independent randomisation of μ and σ.** These are neuromuscular
  *system* parameters — they belong to the writer, not the stroke, and are held
  constant per person in the source literature.
- **Modelling overshoot or hooks explicitly.** ΣΛ gives them.
- **Large slant jitter**, or **σ outside 0.1–0.45**, or **μ outside −2.2..−1.6**
  for a given `t0` convention.

---

## 8. Does it actually fool people?

A perceptual Turing test with **369 participants and 6273 answers** returned a
47.65% false-match rate and a 45.67% false-hit rate — statistical chance. A
separate handwriting-image study found 49.3% correct identification with a 55.4%
false-positive rate, meaning synthetic samples were judged real *more* often than
genuine ones were.

The residual gap the authors name themselves is that their synthetics are **too
smooth**: real samples carry acquisition noise and device irregularity that the
model does not reproduce.

Reconstruction quality is measured as SNR in dB: **>25 dB is good, >30 dB
excellent, 15 dB the floor**; field-typical is 24.1 ± 4.4 dB.

---

## Sources

**Sigma-Lognormal**
- [Ferrer, Diaz, Carmona-Duarte, Quintana, Plamondon — *Synthesis of 3D on-air signatures with the Sigma-Lognormal model*](https://arxiv.org/abs/2401.16329)
- [Berio, Fol Leymarie, Plamondon — *Computer Aided Design of Handwriting Trajectories*, IGS 2017](https://research.gold.ac.uk/id/eprint/20757/1/berio-igs2017.pdf) — the erf angular equation and closed form
- [Berio, Fol Leymarie, Plamondon — *Expressive Curve Editing with the Sigma Lognormal Model*, EG 2018](https://research.gold.ac.uk/id/eprint/23409/1/eg-2018-short-lognormal.pdf) — cleanest equations, Δt defaults
- [Djioua & Plamondon — *Extraction of delta-lognormal parameters*, EPM-RT-2008-04](https://publications.polymtl.ca/3165/1/EPM-RT-2008-04_Djioua.pdf) — the empirical parameter ranges
- [Plamondon et al. — *The lognormal handwriter*](https://pmc.ncbi.nlm.nih.gov/articles/PMC3867641/) — SNR thresholds
- [Ferrer et al. — *iDeLog*](https://arxiv.org/pdf/2401.15473) — measured SNR tables

**Perturbation and synthesis**
- [Lai & Jin — *SynSig2Vec*, AAAI 2020](https://arxiv.org/pdf/1911.05358) — admissible ranges, G1/G2 levels, the shared-draw rule
- [Bhattacharya, Plamondon et al., IJDAR 20(3), 2017](https://link.springer.com/article/10.1007/s10032-017-0287-5) — origin of those ranges via visual Turing test
- [Carmona-Duarte, Ferrer, Parziale, Marcelli — *Temporal Evolution in Synthetic Handwriting*](https://arxiv.org/pdf/2401.15472) — the breaking points
- [Berio et al. — *Calligraphic Stylisation Learning*, MOCO 2017](https://arxiv.org/pdf/1710.01214)

**Power law**
- [Lacquaniti, Terzuolo & Viviani 1983](https://pubmed.ncbi.nlm.nih.gov/6666647/) — the original
- [Huh & Sejnowski — *Spectrum of power laws for curved hand movements*, PNAS 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4517202/) — β is not universally 2/3
- [Schaal & Sternad 2001](https://link.springer.com/article/10.1007/s002210000505) — documented violations

**Neural, distortion, type**
- [Graves — *Generating Sequences With Recurrent Neural Networks*](https://arxiv.org/abs/1308.0850) — the bias dial, and the contextual-variation observation
- [Simard, Steinkraus & Platt, ICDAR 2003](https://cognitivemedium.com/assets/rmnist/Simard.pdf) — elastic distortion; note the paper labels σ=8 as "the properties of the hand" while σ=4 (its best classifier result) is called "too much variability"
- [OpenType at Work: Contextual Alternates](https://typenetwork.com/articles/opentype-at-work-contextual-alternates)
- [*A survey of handwriting synthesis from 2019 to 2024*, Pattern Recognition 2025](https://www.sciencedirect.com/science/article/pii/S0031320325000172) — the perceptual give-aways

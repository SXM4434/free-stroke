/**
 * REGISTERS — two named looks the app can wear, switchable at runtime.
 *
 * WHY THIS EXISTS
 * Free Stroke and Desk Doodles are the same engine pointed at two different
 * aesthetics, and they disagree on almost every surface value. Free Stroke is
 * deliberately maximal: gloss, metals, neon, iridescence, texture/dither/ASCII
 * layers. Desk Doodles is deliberately austere: one warm near-black ink, matte
 * everything, value earned from light and mark density rather than from hue.
 *
 * Rather than fork the app or hardcode one look, both are expressed here as
 * DATA. A register is a complete description of a look; switching registers
 * re-points the same engine. This is the shape that can port into the real
 * Desk Doodles app, because nothing here is a free-stroke-specific component —
 * it is a value table.
 *
 * PROVENANCE — every Desk Doodles number below is copied from that codebase or
 * its locked docs, not invented. Sources are cited per field. Two of its rules
 * are load-bearing and are the reason the DD register looks the way it does:
 *
 *   "It's ALL ONE PENCIL … 3D must carry the SAME pencil-sketch character: a
 *    matte black/grayscale SKETCH … NOT a glossy lit black solid that kills the
 *    sketch feel."                        — desk-doodles/SESSION-HANDOFF.md
 *
 *   "I-9. Token discipline. Smart Hachure consumes locked-system tokens only
 *    (W1 / W1-D ink, locked type, locked spacing). Never invents tokens."
 *                — desk-doodles/docs/locked-refs/.../09-LOCKED-MODEL.md §2
 *
 * So the DD register invents nothing: its palette is the locked W1 ramp, its
 * type sizes come from the locked ladder, its spacing from the locked scale.
 * The Free Stroke register is this app's own existing defaults, gathered.
 */

import type { MaterialPreset } from "./style-system"
import type { RigId } from "@/components/studio-rig"

export type RegisterId = "desk-doodles" | "free-stroke"

/** Surface + ink colours. DD's come from the locked W1 "Near-White Hold" ramp. */
export type RegisterPalette = {
  /** Page ground. */
  bg: string
  /** A panel or card lifted off the ground. */
  raised: string
  /** A well or inset area. */
  recessed: string
  /** The quietest filled surface (track backgrounds, disabled fills). */
  muted: string
  /** Hairline borders. */
  border: string
  /** Headings and anything that must read as "the ink". */
  textPrimary: string
  /** Running text. */
  textBody: string
  /** De-emphasised running text. */
  textBodySoft: string
  /** Labels, captions, section headers. */
  textSecondary: string
  /** The faintest legible ink — annotations, units, tick labels. */
  textDetail: string
  /** Filled buttons / active pills. */
  accent: string
  /** Text on top of `accent`. */
  onAccent: string
}

export type RegisterType = {
  /** Display voice — the wordmark and hero line. */
  display: string
  /** Editorial headings. */
  heading: string
  /** Body, UI and letterspaced caps. */
  body: string
  /**
   * The permitted size ladder, in px. Sizes outside this list are drift — DD's
   * locked typography doc names 14/16/17/19/20/21/24/27/31/36 as explicitly NOT
   * in the system, which is why the ladder is enumerated rather than computed.
   */
  ladder: readonly number[]
  /** Tracking for the small-caps label style, in em. */
  capsTracking: number
}

export type RegisterMotion = {
  /** Panel expand/collapse. */
  panelMs: number
  /** Popovers and dropdowns; origin-aware. */
  popoverMs: number
  /**
   * The one moment allowed to overshoot: an object landing/settling. DD's motion
   * research calls the character "weighted calm" — paper doesn't bounce, but
   * minting an object is rare enough to earn a moment. One spring, interruptible.
   */
  settleMs: number
  settleFrom: number
  /** Stagger between items in a list/grid reveal. */
  staggerMs: number
  /** Standard easing for everything that is not the settle. */
  ease: string
}

/**
 * THE LIGHTING SELECTION.
 *
 * This is a SWITCH, not a rig. The rigs themselves are real code, ported whole
 * from the app each register belongs to, and they live in
 * `components/studio-rig.tsx` with their provenance and their measured-failure
 * comments intact. Expressing the light as a parameter table here would have
 * meant re-deriving two rigs from a summary of them — which is exactly how the
 * numbers that record a fixed bug (the tan flood, the grey-washed rim) get
 * quietly lost. So the register carries the CHOICE and the two decorations
 * that ride on it; the rig carries itself.
 *
 * A register is still a portable value table: everything here is data, and a
 * consumer that has both rigs can honour it.
 */
export type RegisterLighting = {
  /** Which studio rig lights this register. */
  rig: RigId
  /**
   * Whether the fresnel rim glow is injected into the material. Desk Doodles
   * added it because an ink-black form otherwise reads as a featureless
   * silhouette — the rim is what makes the FORM legible at any size or orbit
   * angle, where a positional rim light fails at thumbnail scale. Free Stroke
   * does not need it: its gloss/clearcoat presets produce their own edge
   * separation, and a second warm edge term on top would double it.
   */
  rim: boolean
  /**
   * Whether a soft ground-contact shadow pools under the form — the cue that
   * it is an OBJECT above paper rather than a mark on it. Suppressed on a
   * transparent background by the viewport, where a shadow patch reads as
   * dirt rather than as contact (Desk Doodles' own rule).
   */
  contactShadow: boolean
}

export type Register = {
  id: RegisterId
  label: string
  /** One line on what this register is for — shown in the UI beside the toggle. */
  note: string
  palette: RegisterPalette
  type: RegisterType
  /** The locked spacing scale, in px. */
  spacing: readonly number[]
  motion: RegisterMotion
  /** Radius for pills/buttons. DD uses fully-rounded pills as a house constant. */
  pillRadius: number
  /**
   * The 3D surface this register puts on the form by default, as a preset id.
   * A preset rather than inline params because `CustomMaterial` cannot express
   * `reflectivity`, and that single field is the difference between a matte
   * graphite form and a subtly glossy one.
   */
  materialPreset: MaterialPreset
  /**
   * The light this register is rendered under. Surface without light was the
   * old gap: Desk Doodles' 3D look is not only matteClay, it is matteClay
   * under a specific studio rig, and swapping the material alone got the
   * surface right and the light wrong. See `RegisterLighting`.
   */
  lighting: RegisterLighting
  /**
   * True once `lighting` is actually consumed by the viewport — i.e. switching
   * this register changes the LIGHT and not only the surface. Kept as an
   * explicit field rather than deleted because the UI reads it to decide
   * whether it still owes the viewer an honesty note.
   */
  lightingRigged: boolean
  /** Which geometry engine leads. */
  defaultMode: "rod" | "extrude" | "solid" | "inflate"
  /**
   * Whether the screen-space style layers (texture / dither / ASCII / sweep)
   * are on by default. DD's law is that the marks ARE the product and tonal
   * range comes from light — a full-screen dither over the form fights that,
   * so they default off in the DD register but remain available.
   */
  styleLayersDefaultOn: boolean
}

/**
 * DESK DOODLES.
 *
 * Palette = the locked W1 "Near-White Hold" ramp verbatim. The darks are
 * deliberately unified (primary, accent and CTA background are all #121110):
 * in W1 the graphite ink IS the accent, and a separate accent hue would
 * reintroduce exactly the chromatic promotion W1 was chosen to avoid.
 *
 * Material = `matteClay`, read from desk-doodles
 * src/app/components/canvas3d/materials3d.ts. Every geometry mode there defaults
 * to it. Note what it is NOT: no clearcoat, no sheen, no metalness, and an
 * envMapIntensity of 0.12 rather than ~1. There is no highlight to catch,
 * which is the point — the form reads as matte graphite and its tonal range has
 * to be produced by light falling across it.
 *
 * Colour is the warm near-black #2A2622 (INK_3D_DEFAULT), NOT pure black and
 * NOT free-stroke's cooler #26262b. Its sanctioned range is #121110 → #383632.
 */
export const DESK_DOODLES: Register = {
  id: "desk-doodles",
  label: "Desk Doodles",
  note: "One pencil. Matte ink, value from light. Never hue, never gloss.",
  palette: {
    bg: "#FDFCF9",
    raised: "#F9F7F3",
    recessed: "#F3F0E8",
    muted: "#EBE7DC",
    border: "#E3DFD4",
    textPrimary: "#121110",
    textBody: "#383632",
    textBodySoft: "#797369",
    textSecondary: "#5F5B54",
    textDetail: "#878075",
    accent: "#121110",
    onAccent: "#FDFCF9",
  },
  type: {
    // Fallbacks matter: these three faces are loaded by the Desk Doodles app,
    // and this lab may not serve them. The stacks degrade to a serif/sans of
    // the right character rather than to the browser default.
    display: '"Instrument Serif", "Iowan Old Style", Georgia, serif',
    heading: '"Instrument Serif", "Iowan Old Style", Georgia, serif',
    body: '"Instrument Sans", ui-sans-serif, system-ui, -apple-system, sans-serif',
    ladder: [10, 11, 13, 15, 18, 22, 32, 52],
    capsTracking: 0.08,
  },
  spacing: [4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 128],
  motion: {
    panelMs: 260,
    popoverMs: 180,
    settleMs: 420,
    settleFrom: 0.92,
    staggerMs: 50,
    ease: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
  pillRadius: 999,
  materialPreset: "deskDoodles",
  // The rig is Desk Doodles' own `StudioRig`, ported whole (see
  // components/studio-rig.tsx): ambient + a warm-sky/paper-bounce hemisphere +
  // warm key at (5,8,5) + cool fill + bounce + a NEAR POINT LIGHT with physical
  // decay, over a baked dark ink-family environment. The point light is the
  // load-bearing one: a directional shades a flat camera-facing face perfectly
  // uniformly (constant N·L), which is precisely what makes an extruded form
  // read as a featureless blob. Rim and contact shadow both on — the two cues
  // that turn an ink-black silhouette into an object sitting on paper.
  lighting: { rig: "desk-doodles-studio", rim: true, contactShadow: true },
  lightingRigged: true,
  // Desk Doodles' craft pass names Inflate as the mode that should lead: it is
  // the one that reads as a drawn mark given volume rather than as an extruded
  // logo. (CRAFT-VISUAL-PASS.md R5.)
  defaultMode: "inflate",
  styleLayersDefaultOn: false,
}

/**
 * FREE STROKE — this app's own register, gathered from its existing defaults.
 *
 * The material is the `ink` preset from lib/style-system.ts: a dark glossy
 * gel-ink, charcoal rather than pure black specifically so the hard clearcoat
 * highlight has a surface to sit on. That is the exact inverse of the DD law,
 * and it is correct here — gloss is how this register produces its tonal range.
 */
export const FREE_STROKE: Register = {
  id: "free-stroke",
  label: "Free Stroke",
  note: "The full range. Gloss, metals, and the screen-space style stack.",
  palette: {
    bg: "#0b0b0d",
    raised: "#141419",
    recessed: "#08080a",
    muted: "#1d1d24",
    border: "#2a2a33",
    textPrimary: "#f4f4f6",
    textBody: "#d6d6de",
    textBodySoft: "#9a9aa6",
    textSecondary: "#b0b0bb",
    textDetail: "#7c7c88",
    accent: "#f4f4f6",
    onAccent: "#0b0b0d",
  },
  type: {
    display: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    heading: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    // Free Stroke has no locked ladder; this is a conventional modular scale.
    ladder: [11, 12, 13, 14, 16, 20, 28, 40],
    capsTracking: 0.06,
  },
  spacing: [4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 128],
  motion: {
    panelMs: 200,
    popoverMs: 140,
    settleMs: 320,
    settleFrom: 0.94,
    staggerMs: 32,
    ease: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
  pillRadius: 8,
  materialPreset: "ink",
  // Free Stroke's own rig, unchanged: a hotter nine-panel environment built so
  // chrome reads as chrome and a clearcoat has hard-edged structure to mirror.
  // No rim (the gloss already separates the edge) and no contact shadow (this
  // is a lab viewport with a grid, not a product shot).
  lighting: { rig: "free-stroke-studio", rim: false, contactShadow: false },
  lightingRigged: true,
  defaultMode: "inflate",
  styleLayersDefaultOn: true,
}

export const REGISTERS: Record<RegisterId, Register> = {
  "desk-doodles": DESK_DOODLES,
  "free-stroke": FREE_STROKE,
}

export const REGISTER_ORDER: readonly RegisterId[] = ["desk-doodles", "free-stroke"]

/* ─────────────────────────────────────────────────────────────────────────────
 * DEV-ONLY: LET A HARNESS TURN THE RIM OFF ON THE REGISTER IT IS MEASURING.
 *
 * WHY THIS EXISTS. `scripts/verify/assert-register-light.mjs` asserts the
 * fresnel rim by how far the silhouette sits above the body. Its threshold —
 * `> 58` — was calibrated by measuring the SAME register twice, rim on (62.9)
 * and rim off (53.4), at a framing that file could still produce. That framing
 * no longer exists: `/desk-doodles` now owns the reveal clock, so the harness
 * parks the transport in `orbit` and the beat decides how large the mark sits.
 * At today's framing the reading is 55.27 — BETWEEN the two calibration points,
 * so the row cannot say which side of its own question it is on.
 *
 * Recalibrating needs a rim-off render of the SAME register at the SAME
 * framing, and nothing exposed `lighting.rim`: it is a constant on the register
 * and `components/viewport-3d.tsx` reads it straight off the prop. The
 * alternative on offer was to LOWER 58 to fit, which turns a stale calibration
 * into a green row that means nothing — the exact defect that file's own comment
 * refuses.
 *
 * WHY A MUTATION AND NOT A THIRD REGISTER. Adding a `desk-doodles-no-rim`
 * register would put a third pill in the "Visual register" group — a change to
 * what the app LOOKS like, made for a measurement. Mutating the existing table
 * behind a dev guard changes nothing a user can reach, and the assert restores
 * it in the same run.
 *
 * CONTRACT: dev builds only; a no-op unless a script calls it; and the call
 * returns the previous value so the caller can put it back. The consumer reads
 * `lighting.rim` during render, so a re-render has to be forced after the call —
 * the assert does that by clicking the register pills, which is the real UI
 * path.
 * ──────────────────────────────────────────────────────────────────────────── */
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  ;(window as unknown as Record<string, unknown>).__registerHarness = {
    get: (id: RegisterId) => REGISTERS[id]?.lighting,
    /** Returns the value that was there before, or null if the id is unknown. */
    setRim: (id: RegisterId, on: boolean): boolean | null => {
      const r = REGISTERS[id]
      if (!r) return null
      const was = r.lighting.rim
      // A NEW lighting object, not a field write: `viewport-3d` memoises the
      // material on the scalar `lighting.rim`, and a consumer that compared the
      // object identity would otherwise never see the change.
      r.lighting = { ...r.lighting, rim: on }
      return was
    },
  }
}

/** Emit a register's palette + type as CSS custom properties for a subtree. */
export function registerCssVars(r: Register): Record<string, string> {
  return {
    "--reg-bg": r.palette.bg,
    "--reg-raised": r.palette.raised,
    "--reg-recessed": r.palette.recessed,
    "--reg-muted": r.palette.muted,
    "--reg-border": r.palette.border,
    "--reg-text": r.palette.textPrimary,
    "--reg-body": r.palette.textBody,
    "--reg-body-soft": r.palette.textBodySoft,
    "--reg-secondary": r.palette.textSecondary,
    "--reg-detail": r.palette.textDetail,
    "--reg-accent": r.palette.accent,
    "--reg-on-accent": r.palette.onAccent,
    "--reg-display": r.type.display,
    "--reg-heading": r.type.heading,
    "--reg-body-font": r.type.body,
    "--reg-caps-tracking": `${r.type.capsTracking}em`,
    "--reg-pill": `${r.pillRadius}px`,
    "--reg-panel-ms": `${r.motion.panelMs}ms`,
    "--reg-popover-ms": `${r.motion.popoverMs}ms`,
    "--reg-ease": r.motion.ease,
  }
}

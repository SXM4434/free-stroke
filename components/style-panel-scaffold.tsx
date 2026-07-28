"use client"

import {
  type StyleState,
  type CustomMaterial,
  MATERIAL_PRESETS,
  MATERIAL_ANIMATION_TYPES,
  resolveMaterialParams,
  TEXTURE_MODES,
  DITHER_PRESETS,
  ASCII_PRESETS,
  type PresetFamily,
  PRESET_FAMILY_OPTIONS,
  PRESET_REGISTRY,
  findPreset,
} from "@/lib/style-system"

/**
 * StylePanelScaffold
 * ------------------
 * The single home for each style system's controls. The top strip in page.tsx
 * is a READ-ONLY summary (it shows current selections and opens the matching
 * panel on click); the live control for each system lives HERE, inside its own
 * panel.
 *
 * As of POST_MVP_MATERIAL_AND_ANIMATION_IA_PHASE_1, two panels are real:
 *   - Material  → drives the 3D surface + Animated Material v1 (preview-only).
 *   - Animation → the top-level home for the WHOLE animation system. Only
 *                 "Material Animation" is functional this branch; every other
 *                 animation category (Geometry / Texture / Dither / ASCII /
 *                 Layer / Stack / Fusion) is shown as RESERVED IA so future
 *                 phases have a clear place to land without renaming anything.
 *
 * Nothing here fakes functionality: reserved rows are clearly labeled.
 */

type PanelStatus = "active" | "reserved"

/** Stable ids shared with the top strip so it can open a matching panel. */
export type StylePanelId =
  | "material"
  | "animation"
  | "texture"
  | "dither"
  | "ascii"
  | "presets"
  | "layers"
  | "fusion"

type PanelDef = {
  id: StylePanelId
  label: string
  status: PanelStatus
  note: string
  futureControls: string[]
}

const PANELS: PanelDef[] = [
  {
    id: "material",
    label: "Material",
    status: "active",
    note: "Material surface is live in the 3D preview. Animated Material v1 (below) animates surface response only — it never changes geometry, draw-in, or export.",
    futureControls: ["custom color", "roughness slider", "metalness slider", "clearcoat slider", "save custom material"],
  },
  {
    id: "animation",
    label: "Animation",
    status: "active",
    note: "Top-level home for the whole animation system. Only Material Animation is functional this branch; every other category is reserved IA (renderer later).",
    futureControls: [],
  },
  {
    id: "texture",
    label: "Texture",
    status: "active",
    note: "Procedural pattern renderer is live on all four modes (grain / noise / scanlines / bands / contour). Patterns modulate ink tone + roughness only — never geometry, draw-in, or export geometry.",
    futureControls: ["blend mode", "rotation", "per-axis scale", "second texture layer", "custom texture"],
  },
  {
    id: "dither",
    label: "Dither",
    status: "active",
    note: "Threshold renderer is live on all four modes (Bayer 4x4/8x8, noise threshold, halftone, lines). Reduces final shaded tone after lighting — never geometry, draw-in, or export geometry.",
    futureControls: ["custom threshold map", "per-channel dither", "palette quantization", "dither blend mode"],
  },
  {
    id: "ascii",
    label: "ASCII",
    status: "active",
    note: "Glyph renderer is live on all four modes. 5x5 bitmap characters drawn in-shader (no font, no atlas), chosen per cell by brightness. Never geometry, draw-in, or export geometry.",
    futureControls: ["custom character string", "colour mode", "background fill", "true cell-average sampling"],
  },
  {
    id: "presets",
    label: "Presets",
    status: "active",
    note: "Material presets apply today. Non-material preset families are staged for their renderers.",
    futureControls: ["save custom", "preview thumbnails"],
  },
  {
    id: "layers",
    label: "Layers",
    status: "active",
    note: "Stack compositor is live: per-layer opacity, blend mode, and post-lighting order. Texture is always the base (it modulates the surface before lighting, so it cannot be reordered above the others).",
    futureControls: ["stack-level animation", "more blend modes", "save custom stack", "per-layer solo/mute"],
  },
  {
    id: "fusion",
    label: "Fusion",
    status: "reserved",
    note: "Fusion blends multiple style systems. Fusion renderer not implemented yet.",
    futureControls: ["fusion preset", "mix weights", "transition curve"],
  },
]

/**
 * ANIMATION_CATEGORIES — the full, explicit Animation IA. This is the spec's
 * required "Animation is not only animated material" correction. Only
 * `material` is functional this branch; the rest carry the reserved future
 * branch label so the system is honestly scoped and nothing has to be renamed
 * when those phases land.
 */
const ANIMATION_CATEGORIES: {
  key: string
  label: string
  state: "active" | "basic" | "reserved"
  detail: string
  futureBranch?: string
}[] = [
  {
    key: "geometry",
    label: "Geometry Animation",
    state: "basic",
    detail: "Stroke/form reveal + draw-in playback exists today via the timeline. Advanced controls (easing, loop, reverse, stroke order, settle/wobble) land later.",
    futureBranch: "POST_MVP_ADVANCED_GEOMETRY_ANIMATION_CONTROLS_PHASE_1",
  },
  {
    key: "material",
    label: "Material Animation",
    state: "active",
    detail: "Active now (v1). Animates surface response only — shine sweep, gel shimmer, roughness pulse, completion flash, signal flicker. Configure it in the Material panel.",
  },
  {
    key: "texture",
    label: "Texture Animation",
    state: "active",
    detail: "Active now (v1). Pattern MOTION only — grain drift, noise movement, scanline scroll, band crawl, ripple. Configure it in the Texture panel.",
  },
  {
    key: "dither",
    label: "Dither Animation",
    state: "active",
    detail: "Active now (v1). THRESHOLD motion — matrix crawl and threshold-bias sweep, with reveal-synced opening. Configure it in the Dither panel.",
  },
  {
    key: "ascii",
    label: "ASCII Animation",
    state: "active",
    detail: "Active now (v1). GLYPH motion — scroll, rain, character cycle, flicker, reveal density. Configure it in the ASCII panel.",
  },
  {
    key: "layer",
    label: "Layer Animation",
    state: "reserved",
    detail: "Per-layer speed, phase, delay, sync, enable/disable inside the layer stack.",
    futureBranch: "POST_MVP_LAYER_STACK_AND_LAYER_ANIMATION_PHASE_1",
  },
  {
    key: "stack",
    label: "Stack Animation",
    state: "reserved",
    detail: "Whole-stack fade, pulse, drift, delay, loop, freeze on complete.",
    futureBranch: "POST_MVP_STACK_ANIMATION_PHASE_1",
  },
  {
    key: "fusion",
    label: "Fusion Animation",
    state: "reserved",
    detail: "Authored linked systems: Terminal Gel reveal, Dither Bloom, Signal Ink data flow, etc.",
    futureBranch: "POST_MVP_ANIMATED_FUSION_MODES_PHASE_1",
  },
]

const selectClass =
  "rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
const fieldLabelClass = "text-[11px] font-medium text-muted-foreground"

/* ---- Material panel control (surface + Animated Material v1) ---- */
function MaterialControl({
  styleState,
  setStyleState,
}: {
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
}) {
  const animOn = styleState.materialAnimationEnabled
  const isCustom = styleState.materialPreset === "custom"
  const params = resolveMaterialParams(styleState.materialPreset, styleState.customMaterial)
  const setCustom = (patch: Partial<CustomMaterial>) =>
    setStyleState((s) => ({ ...s, customMaterial: { ...s.customMaterial, ...patch } }))
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Surface preset</span>
          <select
            value={styleState.materialPreset}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                materialPreset: e.target.value as StyleState["materialPreset"],
                // Explicit pick pins the material so mode switches won't override it.
                materialUserOverride: true,
              }))
            }
            className={selectClass}
          >
            {MATERIAL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {styleState.materialUserOverride && (
          <button
            type="button"
            onClick={() => setStyleState((s) => ({ ...s, materialUserOverride: false }))}
            className="mb-0.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Stop pinning; follow the per-mode default material again"
          >
            Reset to mode default
          </button>
        )}
      </div>

      {/* Read-only surface readout (real values applied to the preview). */}
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {[
          ["roughness", params.roughness.toFixed(2)],
          ["metalness", params.metalness.toFixed(2)],
          ["clearcoat", params.clearcoat.toFixed(2)],
          ["sheen", params.sheen.toFixed(2)],
        ].map(([k, v]) => (
          <span key={k} className="rounded border border-border bg-muted/30 px-2 py-1 text-muted-foreground">
            {k}: <span className="text-foreground">{v}</span>
          </span>
        ))}
      </div>

      {/* Custom Material editor — only when the "Custom…" preset is selected.
          Edits live in styleState.customMaterial and feed resolveMaterialParams,
          so the 3D preview (all modes) updates immediately. */}
      {isCustom && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-3">
          <span className="text-xs font-medium text-foreground">Custom material</span>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className={fieldLabelClass}>Color</span>
              <input
                type="color"
                value={styleState.customMaterial.color}
                onChange={(e) => setCustom({ color: e.target.value })}
                className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className={fieldLabelClass}>Sheen color</span>
              <input
                type="color"
                value={styleState.customMaterial.sheenColor}
                onChange={(e) => setCustom({ sheenColor: e.target.value })}
                className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className={fieldLabelClass}>Emissive</span>
              <input
                type="color"
                value={styleState.customMaterial.emissive}
                onChange={(e) => setCustom({ emissive: e.target.value })}
                className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
              />
            </label>
          </div>
          {(
            [
              ["Roughness", "roughness", 0, 1, 0.01],
              ["Metalness", "metalness", 0, 1, 0.01],
              ["Clearcoat", "clearcoat", 0, 1, 0.01],
              ["Sheen", "sheen", 0, 1, 0.01],
              ["Emissive", "emissiveIntensity", 0, 2, 0.01],
              ["Reflection", "envMapIntensity", 0, 3, 0.05],
            ] as const
          ).map(([label, key, min, max, step]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className={fieldLabelClass}>
                {label}{" "}
                <span className="text-foreground">{styleState.customMaterial[key].toFixed(2)}</span>
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={styleState.customMaterial[key]}
                onChange={(e) => setCustom({ [key]: Number(e.target.value) } as Partial<CustomMaterial>)}
                className="w-full accent-foreground"
              />
            </label>
          ))}
        </div>
      )}

      {/* Animated Material v1 — preview-only surface animation. */}
      <div className="rounded-md border border-border bg-muted/20 p-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={animOn}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                materialAnimationEnabled: e.target.checked,
                materialAnimationType:
                  e.target.checked && s.materialAnimationType === "none"
                    ? "shineSweep"
                    : s.materialAnimationType,
              }))
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          <span className="text-xs font-medium text-foreground">Material Animation</span>
          <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
            preview only
          </span>
        </label>

        <div className={`mt-3 flex flex-col gap-3 ${animOn ? "" : "pointer-events-none opacity-50"}`}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Type</span>
            <select
              value={styleState.materialAnimationType}
              onChange={(e) =>
                setStyleState((s) => ({
                  ...s,
                  materialAnimationType: e.target.value as StyleState["materialAnimationType"],
                }))
              }
              className={selectClass}
              disabled={!animOn}
            >
              {MATERIAL_ANIMATION_TYPES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>
              Speed <span className="text-foreground">{styleState.materialAnimationSpeed.toFixed(2)}×</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={styleState.materialAnimationSpeed}
              onChange={(e) =>
                setStyleState((s) => ({ ...s, materialAnimationSpeed: Number(e.target.value) }))
              }
              className="w-48 accent-foreground"
              disabled={!animOn}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>
              Intensity{" "}
              <span className="text-foreground">{Math.round(styleState.materialAnimationIntensity * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={styleState.materialAnimationIntensity}
              onChange={(e) =>
                setStyleState((s) => ({ ...s, materialAnimationIntensity: Number(e.target.value) }))
              }
              className="w-48 accent-foreground"
              disabled={!animOn}
            />
          </label>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Timing follows the <span className="font-medium text-foreground">Animation</span> panel&apos;s motion
            mode: &ldquo;Sync to Draw&rdquo; ties it to stroke draw-in; otherwise it runs on its own clock.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---- Shared per-layer timing control (POST_MVP_VISUAL_TIMING_SYSTEM) ----
 * Every animated layer answers the same question — which clock do I ride, and
 * when do I start? Rendering that as one component keeps the three systems
 * consistent and means new sync modes appear everywhere at once. */
function LayerTimingControl({
  label,
  syncMode,
  delay,
  disabled,
  onSync,
  onDelay,
}: {
  label: string
  syncMode: StyleState["syncMode"]
  delay: number
  disabled: boolean
  onSync: (v: StyleState["syncMode"]) => void
  onDelay: (v: number) => void
}) {
  return (
    <div className={`flex flex-col gap-3 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>{label} timing</span>
        <select
          value={syncMode}
          onChange={(e) => onSync(e.target.value as StyleState["syncMode"])}
          className={selectClass}
          disabled={disabled}
        >
          <option value="independent">Independent — own clock</option>
          <option value="revealSynced">Reveal synced — rides the draw-in</option>
          <option value="strokeTimeSynced">Stroke time — the gesture&apos;s own tempo</option>
          <option value="delayedAfterReveal">After reveal — starts once drawing ends</option>
          <option value="completionPulse">Completion pulse — one-shot burst</option>
          <option value="loopSynced">Loop synced — shared loop</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>
          Delay <span className="text-foreground">{delay.toFixed(1)}s</span>
        </span>
        <input
          type="range"
          min={0}
          max={4}
          step={0.1}
          value={delay}
          onChange={(e) => onDelay(Number(e.target.value))}
          className="w-48 accent-foreground"
          disabled={disabled}
        />
      </label>
    </div>
  )
}

/* ---- Texture panel: procedural pattern renderer (IMPLEMENTED v1) ----
 * Texture is PATTERN only. It never sets dither (threshold) or ASCII (glyph)
 * state — those are sibling systems with their own panels. */
function TextureControl({
  styleState,
  setStyleState,
}: {
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
}) {
  const texOn = styleState.textureEnabled && styleState.textureMode !== "none"
  const animOn = texOn && styleState.textureAnimated
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">Texture</span>
          <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
            {texOn ? "active" : "off"}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Procedural pattern on the surface. Separate from Dither (threshold marks) and ASCII
          (glyphs). Patterns modulate ink tone and roughness — they never change geometry.
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Pattern</span>
        <select
          value={texOn ? styleState.textureMode : "none"}
          onChange={(e) => {
            const v = e.target.value as StyleState["textureMode"]
            setStyleState((s) =>
              v === "none"
                ? { ...s, textureEnabled: false, textureMode: "none" }
                : { ...s, textureEnabled: true, textureMode: v },
            )
          }}
          className={selectClass}
        >
          {TEXTURE_MODES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <div className={`flex flex-col gap-3 ${texOn ? "" : "pointer-events-none opacity-50"}`}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Scale <span className="text-foreground">{styleState.textureScale.toFixed(2)}×</span>
          </span>
          <input
            type="range"
            min={0.2}
            max={4}
            step={0.05}
            value={styleState.textureScale}
            onChange={(e) => setStyleState((s) => ({ ...s, textureScale: Number(e.target.value) }))}
            className="w-48 accent-foreground"
            disabled={!texOn}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Intensity{" "}
            <span className="text-foreground">{Math.round(styleState.textureIntensity * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={styleState.textureIntensity}
            onChange={(e) => setStyleState((s) => ({ ...s, textureIntensity: Number(e.target.value) }))}
            className="w-48 accent-foreground"
            disabled={!texOn}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Contrast{" "}
            <span className="text-foreground">{Math.round(styleState.textureContrast * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={styleState.textureContrast}
            onChange={(e) => setStyleState((s) => ({ ...s, textureContrast: Number(e.target.value) }))}
            className="w-48 accent-foreground"
            disabled={!texOn}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Lock mode</span>
          <select
            value={styleState.textureLockMode}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                textureLockMode: e.target.value as StyleState["textureLockMode"],
              }))
            }
            className={selectClass}
            disabled={!texOn}
          >
            <option value="object">Object (sticks to the form)</option>
            <option value="screen">Screen (graphic overlay)</option>
          </select>
        </label>
      </div>

      {/* Animated texture — PATTERN MOTION only. */}
      <div className="border-t border-border pt-3">
        <label className={`flex items-center gap-2 ${texOn ? "" : "pointer-events-none opacity-50"}`}>
          <input
            type="checkbox"
            checked={styleState.textureAnimated}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                textureAnimated: e.target.checked,
                // Animation needs a running clock; don't silently do nothing.
                motionMode: e.target.checked && s.motionMode === "off" ? "independent" : s.motionMode,
              }))
            }
            className="h-3.5 w-3.5 accent-foreground"
            disabled={!texOn}
          />
          <span className="text-xs font-medium text-foreground">Texture Animation</span>
        </label>

        <div className={`mt-3 flex flex-col gap-3 ${animOn ? "" : "pointer-events-none opacity-50"}`}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>
              Speed <span className="text-foreground">{styleState.textureSpeed.toFixed(2)}×</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={styleState.textureSpeed}
              onChange={(e) => setStyleState((s) => ({ ...s, textureSpeed: Number(e.target.value) }))}
              className="w-48 accent-foreground"
              disabled={!animOn}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Direction</span>
            <select
              value={styleState.textureDirection}
              onChange={(e) =>
                setStyleState((s) => ({
                  ...s,
                  textureDirection: e.target.value as StyleState["textureDirection"],
                }))
              }
              className={selectClass}
              disabled={!animOn}
            >
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
              <option value="diagonal">Diagonal</option>
            </select>
          </label>

          <LayerTimingControl
            label="Texture"
            syncMode={styleState.textureSyncMode}
            delay={styleState.textureDelay}
            disabled={!animOn}
            onSync={(v) => setStyleState((s) => ({ ...s, textureSyncMode: v }))}
            onDelay={(v) => setStyleState((s) => ({ ...s, textureDelay: v }))}
          />

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Pattern motion only. Timing follows the{" "}
            <span className="font-medium text-foreground">Animation</span> panel&apos;s motion mode:
            &ldquo;Sync to Draw&rdquo; makes the pattern travel with the reveal.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---- Dither panel: threshold renderer (IMPLEMENTED v1) ----
 * Dither is TONAL REDUCTION through a threshold map — a different system from
 * Texture (surface pattern) and ASCII (glyphs). It writes only dither* state. */
function DitherControl({
  styleState,
  setStyleState,
}: {
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
}) {
  const ditOn = styleState.ditherEnabled
  const animOn = ditOn && styleState.ditherAnimated
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">Dither</span>
          <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
            {ditOn ? "active" : "off"}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Reduces the final shaded tone to a few levels using a threshold map, so the pattern of
          kept/dropped pixels fakes the shades in between. Applied after lighting — separate from
          Texture (surface pattern) and ASCII (glyphs).
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Threshold map</span>
        <select
          value={ditOn ? styleState.ditherType : "off"}
          onChange={(e) => {
            const v = e.target.value
            setStyleState((s) =>
              v === "off"
                ? { ...s, ditherEnabled: false }
                : { ...s, ditherEnabled: true, ditherType: v as StyleState["ditherType"] },
            )
          }}
          className={selectClass}
        >
          <option value="off">Off</option>
          <option value="bayer4">Bayer 4×4 (ordered)</option>
          <option value="bayer8">Bayer 8×8 (finer ordered)</option>
          <option value="blueNoise">Noise threshold (IGN)</option>
          <option value="halftone">Halftone dots</option>
          <option value="lines">Lines</option>
        </select>
      </label>

      <div className={`flex flex-col gap-3 ${ditOn ? "" : "pointer-events-none opacity-50"}`}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Cell size <span className="text-foreground">{styleState.ditherScale.toFixed(1)}</span>
          </span>
          <input
            type="range"
            min={1}
            max={14}
            step={0.5}
            value={styleState.ditherScale}
            onChange={(e) => setStyleState((s) => ({ ...s, ditherScale: Number(e.target.value) }))}
            className="w-48 accent-foreground"
            disabled={!ditOn}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Tone levels <span className="text-foreground">{styleState.ditherLevels}</span>
          </span>
          <input
            type="range"
            min={2}
            max={8}
            step={1}
            value={styleState.ditherLevels}
            onChange={(e) => setStyleState((s) => ({ ...s, ditherLevels: Number(e.target.value) }))}
            className="w-48 accent-foreground"
            disabled={!ditOn}
          />
          <span className="text-[10px] text-muted-foreground">2 = pure two-tone; higher keeps more shading.</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Threshold bias{" "}
            <span className="text-foreground">{Math.round(styleState.ditherThreshold * 100)}%</span>
          </span>
          <input
            type="range"
            min={0.15}
            max={0.85}
            step={0.01}
            value={styleState.ditherThreshold}
            onChange={(e) => setStyleState((s) => ({ ...s, ditherThreshold: Number(e.target.value) }))}
            className="w-48 accent-foreground"
            disabled={!ditOn}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Contrast <span className="text-foreground">{Math.round(styleState.ditherContrast * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={styleState.ditherContrast}
            onChange={(e) => setStyleState((s) => ({ ...s, ditherContrast: Number(e.target.value) }))}
            className="w-48 accent-foreground"
            disabled={!ditOn}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Amount <span className="text-foreground">{Math.round(styleState.ditherIntensity * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={styleState.ditherIntensity}
            onChange={(e) => setStyleState((s) => ({ ...s, ditherIntensity: Number(e.target.value) }))}
            className="w-48 accent-foreground"
            disabled={!ditOn}
          />
          <span className="text-[10px] text-muted-foreground">Blend between smooth shading and full dither.</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Lock mode</span>
          <select
            value={styleState.ditherLockMode}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                ditherLockMode: e.target.value as StyleState["ditherLockMode"],
              }))
            }
            className={selectClass}
            disabled={!ditOn}
          >
            <option value="screen">Screen (classic graphic dither)</option>
            <option value="object">Object (grid sticks to the form)</option>
          </select>
        </label>
      </div>

      {/* Animated dither — THRESHOLD MOTION. */}
      <div className="border-t border-border pt-3">
        <label className={`flex items-center gap-2 ${ditOn ? "" : "pointer-events-none opacity-50"}`}>
          <input
            type="checkbox"
            checked={styleState.ditherAnimated}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                ditherAnimated: e.target.checked,
                motionMode: e.target.checked && s.motionMode === "off" ? "independent" : s.motionMode,
              }))
            }
            className="h-3.5 w-3.5 accent-foreground"
            disabled={!ditOn}
          />
          <span className="text-xs font-medium text-foreground">Dither Animation</span>
        </label>

        <div className={`mt-3 flex flex-col gap-3 ${animOn ? "" : "pointer-events-none opacity-50"}`}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>
              Speed <span className="text-foreground">{styleState.ditherSpeed.toFixed(2)}×</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={styleState.ditherSpeed}
              onChange={(e) => setStyleState((s) => ({ ...s, ditherSpeed: Number(e.target.value) }))}
              className="w-48 accent-foreground"
              disabled={!animOn}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Motion</span>
            <select
              value={styleState.ditherDirection}
              onChange={(e) =>
                setStyleState((s) => ({
                  ...s,
                  ditherDirection: e.target.value as StyleState["ditherDirection"],
                }))
              }
              className={selectClass}
              disabled={!animOn}
            >
              <option value="static">Threshold sweep (no travel)</option>
              <option value="horizontal">Matrix crawl — horizontal</option>
              <option value="vertical">Matrix crawl — vertical</option>
              <option value="diagonal">Matrix crawl — diagonal</option>
            </select>
          </label>

          <LayerTimingControl
            label="Dither"
            syncMode={styleState.ditherSyncMode}
            delay={styleState.ditherDelay}
            disabled={!animOn}
            onSync={(v) => setStyleState((s) => ({ ...s, ditherSyncMode: v }))}
            onDelay={(v) => setStyleState((s) => ({ ...s, ditherDelay: v }))}
          />

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Threshold motion, not pattern motion. &ldquo;Threshold sweep&rdquo; oscillates the bias so tone
            opens and closes in place; the crawl options travel the matrix. With{" "}
            <span className="font-medium text-foreground">Sync to Draw</span> the threshold opens as the
            stroke reveals.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---- ASCII panel: glyph renderer (IMPLEMENTED v1) ----
 * ASCII is the THIRD system: character glyphs, distinct from Texture (pattern)
 * and Dither (threshold). It writes only ascii* state. */
function AsciiControl({
  styleState,
  setStyleState,
}: {
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
}) {
  const ascOn = styleState.asciiEnabled
  const animOn = ascOn && styleState.asciiAnimated
  const travels =
    styleState.asciiAnimationType === "scroll" || styleState.asciiAnimationType === "rain"
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">ASCII</span>
          <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
            {ascOn ? "active" : "off"}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Splits the surface into a character grid and picks a glyph per cell from its brightness.
          Glyphs are 5×5 bitmaps drawn in the shader — no font, no texture atlas. Separate from
          Texture (pattern) and Dither (threshold).
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Character set</span>
        <select
          value={ascOn ? styleState.asciiCharset : "off"}
          onChange={(e) => {
            const v = e.target.value
            setStyleState((s) =>
              v === "off"
                ? { ...s, asciiEnabled: false }
                : { ...s, asciiEnabled: true, asciiCharset: v as StyleState["asciiCharset"] },
            )
          }}
          className={selectClass}
        >
          <option value="off">Off</option>
          <option value="classic">Classic .:-=+*#%@</option>
          <option value="blocks">Blocks ░▒▓█</option>
          <option value="minimal">Binary 0 1</option>
          <option value="dots">Dots</option>
          <option value="custom">Code marks / &lt; &gt; [ &#123;</option>
        </select>
      </label>

      <div className={`flex flex-col gap-3 ${ascOn ? "" : "pointer-events-none opacity-50"}`}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Cell size <span className="text-foreground">{styleState.asciiCellSize}px</span>
          </span>
          <input
            type="range"
            min={4}
            max={24}
            step={1}
            value={styleState.asciiCellSize}
            onChange={(e) => setStyleState((s) => ({ ...s, asciiCellSize: Number(e.target.value) }))}
            className="w-48 accent-foreground"
            disabled={!ascOn}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Density <span className="text-foreground">{Math.round(styleState.asciiDensity * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={styleState.asciiDensity}
            onChange={(e) => setStyleState((s) => ({ ...s, asciiDensity: Number(e.target.value) }))}
            className="w-48 accent-foreground"
            disabled={!ascOn}
          />
          <span className="text-[10px] text-muted-foreground">Biases the ramp toward sparser or denser characters.</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Contrast <span className="text-foreground">{Math.round(styleState.asciiContrast * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={styleState.asciiContrast}
            onChange={(e) => setStyleState((s) => ({ ...s, asciiContrast: Number(e.target.value) }))}
            className="w-48 accent-foreground"
            disabled={!ascOn}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Lock mode</span>
          <select
            value={styleState.asciiLockMode}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                asciiLockMode: e.target.value as StyleState["asciiLockMode"],
              }))
            }
            className={selectClass}
            disabled={!ascOn}
          >
            <option value="screen">Screen (terminal grid)</option>
            <option value="object">Object (grid sticks to the form)</option>
          </select>
        </label>
      </div>

      {/* Animated ASCII — GLYPH MOTION. */}
      <div className="border-t border-border pt-3">
        <label className={`flex items-center gap-2 ${ascOn ? "" : "pointer-events-none opacity-50"}`}>
          <input
            type="checkbox"
            checked={styleState.asciiAnimated}
            onChange={(e) =>
              setStyleState((s) => ({
                ...s,
                asciiAnimated: e.target.checked,
                asciiAnimationType:
                  e.target.checked && s.asciiAnimationType === "none" ? "scroll" : s.asciiAnimationType,
                motionMode: e.target.checked && s.motionMode === "off" ? "independent" : s.motionMode,
              }))
            }
            className="h-3.5 w-3.5 accent-foreground"
            disabled={!ascOn}
          />
          <span className="text-xs font-medium text-foreground">ASCII Animation</span>
        </label>

        <div className={`mt-3 flex flex-col gap-3 ${animOn ? "" : "pointer-events-none opacity-50"}`}>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Behaviour</span>
            <select
              value={styleState.asciiAnimationType}
              onChange={(e) =>
                setStyleState((s) => ({
                  ...s,
                  asciiAnimationType: e.target.value as StyleState["asciiAnimationType"],
                }))
              }
              className={selectClass}
              disabled={!animOn}
            >
              <option value="scroll">Scroll — the grid travels</option>
              <option value="rain">Rain — columns fall independently</option>
              <option value="cycle">Cycle — glyphs change in place</option>
              <option value="flicker">Flicker — random cells jump</option>
              <option value="revealDensity">Reveal — density grows with draw-in</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>
              Speed <span className="text-foreground">{styleState.asciiScrollSpeed.toFixed(2)}×</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={styleState.asciiScrollSpeed}
              onChange={(e) => setStyleState((s) => ({ ...s, asciiScrollSpeed: Number(e.target.value) }))}
              className="w-48 accent-foreground"
              disabled={!animOn}
            />
          </label>

          <label className={`flex flex-col gap-1 ${travels ? "" : "opacity-50"}`}>
            <span className={fieldLabelClass}>Direction</span>
            <select
              value={styleState.asciiDirection}
              onChange={(e) =>
                setStyleState((s) => ({
                  ...s,
                  asciiDirection: e.target.value as StyleState["asciiDirection"],
                }))
              }
              className={selectClass}
              disabled={!animOn || !travels}
            >
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
              <option value="static">None</option>
            </select>
            {!travels && (
              <span className="text-[10px] text-muted-foreground">
                Only Scroll and Rain travel; the others change glyphs in place.
              </span>
            )}
          </label>

          <LayerTimingControl
            label="ASCII"
            syncMode={styleState.asciiSyncMode}
            delay={styleState.asciiDelay}
            disabled={!animOn}
            onSync={(v) => setStyleState((s) => ({ ...s, asciiSyncMode: v }))}
            onDelay={(v) => setStyleState((s) => ({ ...s, asciiDelay: v }))}
          />

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Glyph motion — not pattern motion (Texture) or threshold motion (Dither). With{" "}
            <span className="font-medium text-foreground">Sync to Draw</span> the motion rides the
            stroke reveal.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---- Layers panel: the stack compositor (IMPLEMENTED v1) ----
 * Composition-level controls: how strongly each layer lands, how it blends, and
 * (for the two post-lighting layers) which runs first. Texture is shown as the
 * base because it is part of the SURFACE — it modulates albedo and roughness
 * before lighting — so it genuinely cannot be reordered above the others
 * without rendering the material twice. Offering a control that silently does
 * nothing would be worse than saying so. */
function LayersControl({
  styleState,
  setStyleState,
  onSelectPreset,
}: {
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
  onSelectPreset: (family: PresetFamily, id: string) => void
}) {
  const on = styleState.layerStackEnabled
  const blendOptions = (
    <>
      <option value="normal">Normal</option>
      <option value="multiply">Multiply (darken only)</option>
      <option value="screen">Screen (lighten only)</option>
    </>
  )
  const row = (
    label: string,
    active: boolean,
    opacity: number,
    onOpacity: (v: number) => void,
    blend?: { value: StyleState["stackDitherBlend"]; onChange: (v: StyleState["stackDitherBlend"]) => void },
  ) => (
    <div className="rounded-md border border-border p-2.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            active ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {active ? "in stack" : "off"}
        </span>
      </div>
      <div className={`mt-2 flex flex-col gap-2 ${active && on ? "" : "pointer-events-none opacity-50"}`}>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>
            Opacity <span className="text-foreground">{Math.round(opacity * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            onChange={(e) => onOpacity(Number(e.target.value))}
            className="w-44 accent-foreground"
            disabled={!active || !on}
          />
        </label>
        {blend ? (
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Blend</span>
            <select
              value={blend.value}
              onChange={(e) => blend.onChange(e.target.value as StyleState["stackDitherBlend"])}
              className={selectClass}
              disabled={!active || !on}
            >
              {blendOptions}
            </select>
          </label>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            Base layer — part of the surface, so it has no blend of its own.
          </span>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => setStyleState((s) => ({ ...s, layerStackEnabled: e.target.checked }))}
            className="h-3.5 w-3.5 accent-foreground"
          />
          <span className="text-xs font-medium text-foreground">Layer stack</span>
          <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
            {on ? "active" : "off"}
          </span>
        </label>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Composes the visual systems. Each layer keeps its own controls in its own panel; the stack
          adds opacity, blend, and order on top. With the stack off, every layer behaves exactly as it
          does on its own.
        </p>
      </div>

      <div className={`flex flex-col gap-2 ${on ? "" : "pointer-events-none opacity-50"}`}>
        {row(
          "1 · Texture (base)",
          styleState.textureEnabled && styleState.textureMode !== "none",
          styleState.stackTextureOpacity,
          (v) => setStyleState((s) => ({ ...s, stackTextureOpacity: v })),
        )}
        {row(
          "2 · Dither",
          styleState.ditherEnabled,
          styleState.stackDitherOpacity,
          (v) => setStyleState((s) => ({ ...s, stackDitherOpacity: v })),
          {
            value: styleState.stackDitherBlend,
            onChange: (v) => setStyleState((s) => ({ ...s, stackDitherBlend: v })),
          },
        )}
        {row(
          "3 · ASCII",
          styleState.asciiEnabled,
          styleState.stackAsciiOpacity,
          (v) => setStyleState((s) => ({ ...s, stackAsciiOpacity: v })),
          {
            value: styleState.stackAsciiBlend,
            onChange: (v) => setStyleState((s) => ({ ...s, stackAsciiBlend: v })),
          },
        )}

        <label className="mt-1 flex flex-col gap-1">
          <span className={fieldLabelClass}>Order (post-lighting layers)</span>
          <select
            value={styleState.stackOrder}
            onChange={(e) =>
              setStyleState((s) => ({ ...s, stackOrder: e.target.value as StyleState["stackOrder"] }))
            }
            className={selectClass}
            disabled={!on}
          >
            <option value="ditherFirst">Dither → ASCII (crisper, printed)</option>
            <option value="asciiFirst">ASCII → Dither (grittier, degraded)</option>
          </select>
          <span className="text-[10px] leading-relaxed text-muted-foreground">
            Dither first means characters are chosen from already-quantized tone. ASCII first means the
            dither breaks up the character shapes themselves. Texture is always the base.
          </span>
        </label>
      </div>

      <div className="border-t border-border pt-3">
        <span className={fieldLabelClass}>Stack presets</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESET_REGISTRY.layerStack.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectPreset("layerStack", p.id)}
              className={`rounded-md border px-2 py-1 text-[11px] ${
                styleState.activePresetId === p.id
                  ? "border-foreground bg-foreground/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              title={p.description}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          Each preset is a composition, not a pile of switches: one dominant layer, the others
          supporting at reduced opacity.
        </p>
      </div>
    </div>
  )
}

/* ---- Animation panel: full IA, only Material is functional ---- */
function AnimationControl({
  styleState,
  setStyleState,
}: {
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Global motion timing — affects which clock animated style systems use. */}
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Motion mode (timing source)</span>
        <select
          value={styleState.motionMode}
          onChange={(e) =>
            setStyleState((s) => ({ ...s, motionMode: e.target.value as StyleState["motionMode"] }))
          }
          className={selectClass}
        >
          <option value="off">Off (static)</option>
          <option value="independent">Independent clock</option>
          <option value="syncToDraw">Sync to Draw</option>
        </select>
      </label>
      <p className="-mt-1 text-[10px] leading-relaxed text-muted-foreground">
        &ldquo;Sync to Draw&rdquo; lets visual (style) animation use draw/reveal progress as its timing input. It
        does <span className="font-medium text-foreground">not</span> change geometry animation behavior.
      </p>

      {/* Shared loop length — every layer on "Loop synced" uses this, which is
          what lets several layers repeat in lockstep. */}
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>
          Shared loop length <span className="text-foreground">{styleState.styleLoopSeconds.toFixed(1)}s</span>
        </span>
        <input
          type="range"
          min={0.5}
          max={12}
          step={0.5}
          value={styleState.styleLoopSeconds}
          onChange={(e) => setStyleState((s) => ({ ...s, styleLoopSeconds: Number(e.target.value) }))}
          className="w-48 accent-foreground"
        />
        <span className="text-[10px] leading-relaxed text-muted-foreground">
          Layers set to &ldquo;Loop synced&rdquo; share this cycle, so they repeat together.
          Each layer&apos;s own timing mode and delay live in its panel.
        </span>
      </label>

      {/* The animation categories. */}
      <div className="flex flex-col gap-1.5">
        {ANIMATION_CATEGORIES.map((c) => {
          const badge =
            c.state === "active"
              ? { text: "active", cls: "bg-foreground/10 text-foreground" }
              : c.state === "basic"
                ? { text: "basic playback", cls: "bg-foreground/10 text-foreground" }
                : { text: "reserved", cls: "bg-muted text-muted-foreground" }
          return (
            <div
              key={c.key}
              className={`rounded-md border border-border p-2.5 ${
                c.state === "active" ? "bg-muted/30" : "bg-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">{c.label}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>{badge.text}</span>
                {c.key === "material" && styleState.materialAnimationEnabled && (
                  <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                    on: {styleState.materialAnimationType}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{c.detail}</p>
              {c.futureBranch && (
                <p className="mt-1 font-mono text-[9px] text-muted-foreground/70">{c.futureBranch}</p>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        No full timeline or keyframes are implemented. Material Animation is configured in the{" "}
        <span className="font-medium text-foreground">Material</span> panel.
      </p>
    </div>
  )
}

/** Renders the real, working control(s) for a given panel. */
function PanelControl({
  id,
  styleState,
  setStyleState,
  onSelectPreset,
}: {
  id: StylePanelId
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
  onSelectPreset: (family: PresetFamily, id: string) => void
}) {
  switch (id) {
    case "material":
      return <MaterialControl styleState={styleState} setStyleState={setStyleState} />
    case "animation":
      return <AnimationControl styleState={styleState} setStyleState={setStyleState} />
    case "texture":
      return <TextureControl styleState={styleState} setStyleState={setStyleState} />

    case "dither":
      return <DitherControl styleState={styleState} setStyleState={setStyleState} />
    case "ascii":
      return <AsciiControl styleState={styleState} setStyleState={setStyleState} />
    case "layers":
      return (
        <LayersControl
          styleState={styleState}
          setStyleState={setStyleState}
          onSelectPreset={onSelectPreset}
        />
      )
    case "presets": {
      const family = styleState.activePresetFamily
      const presets = (PRESET_REGISTRY[family] ?? []).filter((p) => p.enabled)
      const active = findPreset(styleState.activePresetId)
      const activeInFamily = active && active.family === family ? active : undefined
      return (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Family</span>
            <select
              value={family}
              onChange={(e) =>
                setStyleState((s) => ({ ...s, activePresetFamily: e.target.value as PresetFamily }))
              }
              className={selectClass}
            >
              {PRESET_FAMILY_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Preset</span>
            <select
              value={activeInFamily?.id ?? ""}
              onChange={(e) => e.target.value && onSelectPreset(family, e.target.value)}
              className={selectClass}
            >
              <option value="" disabled>
                Select…
              </option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.implemented ? "" : " (soon)"}
                </option>
              ))}
            </select>
          </label>
          {activeInFamily && (
            <span
              className={`mb-1 select-none rounded px-1.5 py-0.5 text-[10px] font-medium ${
                activeInFamily.implemented
                  ? "bg-foreground/10 text-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {activeInFamily.implemented ? "active" : "defined · renderer later"}
            </span>
          )}
        </div>
      )
    }
    default:
      return null
  }
}

export function StylePanelScaffold({
  open,
  activeId,
  styleState,
  setStyleState,
  onSelectPreset,
  onOpenChange,
  onActiveIdChange,
}: {
  open: boolean
  activeId: StylePanelId
  styleState: StyleState
  setStyleState: (updater: (s: StyleState) => StyleState) => void
  onSelectPreset: (family: PresetFamily, id: string) => void
  onOpenChange: (open: boolean) => void
  onActiveIdChange: (id: StylePanelId) => void
}) {
  const active = PANELS.find((p) => p.id === activeId) ?? PANELS[0]
  const hasControl = active.id !== "layers" && active.id !== "fusion"

  return (
    <div className="shrink-0 border-b border-border bg-background">
      {/* Drawer header */}
      <div className="flex items-center gap-2 px-4 py-1.5 text-xs">
        <span className="font-semibold tracking-tight text-foreground">Style panels</span>
        <span className="text-muted-foreground">each system&apos;s controls live in its panel</span>
        <button
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          className="ml-auto rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open && (
        <div className="flex gap-4 px-4 pb-4">
          {/* Tabs */}
          <nav aria-label="Style panel sections" className="flex w-40 shrink-0 flex-col gap-0.5">
            {PANELS.map((p) => (
              <button
                key={p.id}
                onClick={() => onActiveIdChange(p.id)}
                className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                  p.id === activeId
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>{p.label}</span>
                {p.status === "active" && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      p.id === activeId ? "bg-background" : "bg-foreground"
                    }`}
                    aria-hidden
                  />
                )}
              </button>
            ))}
          </nav>

          {/* Active panel body */}
          <div className="max-h-[24rem] min-h-[14rem] flex-1 overflow-y-auto rounded-lg border border-border p-5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{active.label}</h3>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  active.status === "active"
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {active.status}
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{active.note}</p>

            {/* Live control for this system */}
            {hasControl && (
              <div className="mt-4">
                <PanelControl
                  id={active.id}
                  styleState={styleState}
                  setStyleState={setStyleState}
                  onSelectPreset={onSelectPreset}
                />
              </div>
            )}

            {active.futureControls.length > 0 && (
              <div className="mt-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Future controls
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {active.futureControls.map((c) => (
                    <span
                      key={c}
                      className="rounded border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

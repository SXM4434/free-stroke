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
    status: "reserved",
    note: "Texture controls land here. Procedural texture renderer not implemented yet.",
    futureControls: ["scale", "strength", "rotation", "blend mode"],
  },
  {
    id: "dither",
    label: "Dither",
    status: "reserved",
    note: "Dither controls land here. Dither renderer not implemented yet.",
    futureControls: ["scale", "threshold", "contrast", "intensity", "dither direction", "reveal sync"],
  },
  {
    id: "ascii",
    label: "ASCII",
    status: "reserved",
    note: "ASCII controls land here. ASCII renderer not implemented yet.",
    futureControls: ["cell size", "contrast", "color mode", "background"],
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
    status: "reserved",
    note: "Layer stack compositing lands here. Compositor not implemented yet.",
    futureControls: ["add / remove layer", "reorder", "per-layer opacity", "blend mode"],
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
    state: "reserved",
    detail: "Grain drift, noise movement, scanline scroll, band crawl, ripple, bubble drift.",
    futureBranch: "POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1",
  },
  {
    key: "dither",
    label: "Dither Animation",
    state: "reserved",
    detail: "Threshold sweep, Bayer crawl, diagonal drift, reveal dither, controlled flicker.",
    futureBranch: "POST_MVP_DITHER_AND_ANIMATED_DITHER_PHASE_1",
  },
  {
    key: "ascii",
    label: "ASCII Animation",
    state: "reserved",
    detail: "Glyph scroll, ASCII rain, character cycling, reveal glyphs, terminal flicker.",
    futureBranch: "POST_MVP_ASCII_AND_ANIMATED_ASCII_PHASE_1",
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
      return (
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Texture mode</span>
          <select
            value={styleState.textureMode}
            onChange={(e) =>
              setStyleState((s) => ({ ...s, textureMode: e.target.value as StyleState["textureMode"] }))
            }
            className={selectClass}
          >
            {TEXTURE_MODES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )
    case "dither":
      return (
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Dither type</span>
          <select
            value={styleState.ditherEnabled ? styleState.ditherType : "off"}
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
            {DITHER_PRESETS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      )
    case "ascii":
      return (
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Charset</span>
          <select
            value={styleState.asciiEnabled ? styleState.asciiCharset : "off"}
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
            {ASCII_PRESETS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
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

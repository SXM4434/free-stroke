"use client"

import {
  type StyleState,
  MATERIAL_PRESETS,
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
 * is now a READ-ONLY summary (it shows the current selections and opens the
 * matching panel on click); the live control for each system lives HERE, inside
 * its own panel. This removes the old duplication where every system appeared
 * both as a top dropdown and as an empty panel.
 *
 * Each panel renders its real, working control plus the inventory of FUTURE
 * fine-grained controls planned for that system. Controls that have a renderer
 * (Material, Presets) drive visuals today; the rest update style state but are
 * honestly marked "renderer later" — nothing here fakes functionality.
 */

type PanelStatus = "substrate active" | "renderer later"

/** Stable ids shared with the top strip so it can open a matching panel. */
export type StylePanelId =
  | "material"
  | "texture"
  | "dither"
  | "ascii"
  | "motion"
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
    status: "substrate active",
    note: "Material presets are active (surface response). Detailed controls land here.",
    futureControls: ["color", "roughness", "metalness", "clearcoat", "animated material toggle", "shimmer / pulse / sweep"],
  },
  {
    id: "texture",
    label: "Texture",
    status: "renderer later",
    note: "Texture controls land here. Procedural texture renderer not implemented yet.",
    futureControls: ["scale", "strength", "rotation", "animated texture", "texture speed", "blend mode"],
  },
  {
    id: "dither",
    label: "Dither",
    status: "renderer later",
    note: "Dither controls land here. Dither renderer not implemented yet.",
    futureControls: ["scale", "threshold", "contrast", "intensity", "animated dither", "dither speed", "dither direction", "reveal sync"],
  },
  {
    id: "ascii",
    label: "ASCII",
    status: "renderer later",
    note: "ASCII controls land here. ASCII renderer not implemented yet.",
    futureControls: ["cell size", "contrast", "color mode", "background", "animated ascii", "ascii speed"],
  },
  {
    id: "motion",
    label: "Motion",
    status: "renderer later",
    note: "Motion links style animation timing. No style renderer reads motion yet.",
    futureControls: ["speed", "easing", "loop", "phase offset", "reveal coupling"],
  },
  {
    id: "presets",
    label: "Presets",
    status: "substrate active",
    note: "Material presets apply today. Non-material preset families are staged for their renderers.",
    futureControls: ["save custom", "preview thumbnails"],
  },
  {
    id: "layers",
    label: "Layers (later)",
    status: "renderer later",
    note: "Layer stack compositing lands here. Compositor not implemented yet.",
    futureControls: ["add / remove layer", "reorder", "per-layer opacity", "blend mode", "stack animation"],
  },
  {
    id: "fusion",
    label: "Fusion (later)",
    status: "renderer later",
    note: "Fusion blends multiple style systems. Fusion renderer not implemented yet.",
    futureControls: ["fusion preset", "mix weights", "animated fusion", "transition curve"],
  },
]

const selectClass =
  "rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
const fieldLabelClass = "text-[11px] font-medium text-muted-foreground"

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
      return (
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Surface preset</span>
          <select
            value={styleState.materialPreset}
            onChange={(e) =>
              setStyleState((s) => ({ ...s, materialPreset: e.target.value as StyleState["materialPreset"] }))
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
      )
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
    case "motion":
      return (
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Mode</span>
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
                className={`rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                  p.id === activeId
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </nav>

          {/* Active panel body */}
          <div className="min-h-[14rem] flex-1 rounded-lg border border-border p-5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{active.label}</h3>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  active.status === "substrate active"
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
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

/* ==================================================================
   THE RAIL · L4 of the layout rethink (BUILD-PLAN.md §3, "The rail, the one
   place that switches and shows"; his ruling of 2026-09-26: B's thin left
   rail, not A's top tabs, and every icon gets a label).

   48 px on the left. Top: the three workspaces. Then one show / hide per
   panel. At the bottom: Reset this workspace.

   LABELS. At 48 px a label in place costs the width the rail exists to save,
   so every icon's label shows on hover and on keyboard focus, with its
   shortcut, in a tooltip to the rail's right. After the first tooltip opens,
   the next ones open with no delay while the pointer stays on the rail
   (Radix's `skipDelayDuration`), so reading down the rail is not a wait per
   icon. The label is also the button's accessible name.

   TARGETS. Each icon is a 28x28 target (macOS default) on a 36 px pitch. The
   current workspace and each shown panel get the app's active fill, black
   with white.
   ================================================================== */

import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Box, Clapperboard, Download, GanttChart, Palette, PenLine, RotateCcw, SlidersHorizontal, Square, type LucideIcon } from "lucide-react"
import { WORKSPACES, type WorkspaceId } from "@/components/workspace/workspaces"

export type RailPanel = "drawing" | "view3d" | "style" | "timeline" | "export"

const WS_ICON: Record<WorkspaceId, LucideIcon> = { draw: PenLine, style: Palette, animate: Clapperboard }
export const RAIL_PANELS: readonly { id: RailPanel; label: string; icon: LucideIcon }[] = [
  { id: "drawing", label: "Drawing", icon: Square },
  { id: "view3d", label: "3D view", icon: Box },
  { id: "style", label: "Style", icon: SlidersHorizontal },
  { id: "timeline", label: "Timeline", icon: GanttChart },
  { id: "export", label: "Export", icon: Download },
]

function RailButton({
  label,
  hint,
  shortcut,
  icon: Icon,
  on,
  onClick,
  data,
}: {
  label: string
  hint: string
  shortcut?: string
  icon: LucideIcon
  on: boolean
  onClick: () => void
  data: Record<string, string>
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={on}
          onClick={onClick}
          {...data}
          className={`fs-press flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            on ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="right"
          sideOffset={10}
          data-rail-tooltip
          className="z-50 flex items-center gap-2 rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background"
        >
          <span className="font-medium">{label}</span>
          <span className="text-background/70">{hint}</span>
          {shortcut && <kbd className="rounded border border-background/30 px-1 font-mono text-[10px] text-background/80">{shortcut}</kbd>}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export function Rail({
  workspace,
  onWorkspace,
  shown,
  onToggle,
  onReset,
}: {
  workspace: WorkspaceId
  onWorkspace: (ws: WorkspaceId) => void
  shown: Record<RailPanel, boolean>
  onToggle: (id: RailPanel) => void
  onReset: () => void
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={400} skipDelayDuration={600}>
      <nav
        aria-label="Workspaces and panels"
        data-rail
        className="flex w-12 shrink-0 flex-col items-center gap-2 border-r border-border bg-background py-2"
      >
        {WORKSPACES.map((w) => (
          <RailButton
            key={w.id}
            label={w.label}
            hint="workspace"
            shortcut={w.key}
            icon={WS_ICON[w.id]}
            on={workspace === w.id}
            onClick={() => onWorkspace(w.id)}
            data={{ "data-rail-workspace": w.id }}
          />
        ))}
        <div aria-hidden="true" className="my-0.5 h-px w-7 bg-border" />
        {RAIL_PANELS.map((p) => (
          <RailButton
            key={p.id}
            label={p.label}
            hint={shown[p.id] ? "hide" : "show"}
            icon={p.icon}
            on={shown[p.id]}
            onClick={() => onToggle(p.id)}
            data={{ "data-rail-panel": p.id }}
          />
        ))}
        <div className="flex-1" />
        <RailButton
          label="Reset layout"
          hint="this workspace to its default"
          icon={RotateCcw}
          on={false}
          onClick={onReset}
          data={{ "data-rail-reset": "" }}
        />
      </nav>
    </TooltipPrimitive.Provider>
  )
}

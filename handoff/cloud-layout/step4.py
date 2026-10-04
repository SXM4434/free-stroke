R = '/home/user/free-stroke/'


def edit(path, pairs):
    s = open(R + path).read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:70], s.count(a))
        s = s.replace(a, b)
    open(R + path, 'w').write(s)


# 1. THE DRAWING TOOLBAR WRAPS. Two cards, each wraps inside, and the row wraps
#    the second card under the first: at any width he can drag the panel to,
#    no control is cut off. The "nowrap" arm puts back the one row.
edit('components/drawing-canvas.tsx', [
    ('''      {/* Controls: two grouped cards — actions on the left, stroke-processing
          options on the right. No dead gaps inside a group. */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">''',
     '''      {/* Controls: two grouped cards — actions on the left, stroke-processing
          options on the right. No dead gaps inside a group.
          THEY WRAP (CLOUD-LAYOUT): with the panel dragged narrow (35% of the
          window cut the Spacing slider off) the second card goes under the
          first and each card wraps inside, so every control stays whole and
          reachable at any width. Anchored to the bottom, the rows stack up. */}
      <div
        data-fs-toolbar="drawing"
        className={
          TOOLBAR_NOWRAP
            ? "absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3"
            : "absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-2"
        }
      >'''),
    ('''        <div className="flex items-center gap-1 rounded-xl border border-border bg-background/85 p-1 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            onClick={onUndo}''',
     '''        <div className={`flex ${TOOLBAR_NOWRAP ? "" : "flex-wrap"} items-center gap-1 rounded-xl border border-border bg-background/85 p-1 shadow-sm backdrop-blur-sm`}>
          <button
            type="button"
            onClick={onUndo}'''),
    ('''        <div className="flex items-center gap-1 rounded-xl border border-border bg-background/85 p-1 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            onClick={() => onSettingsChange({ smoothing: !smoothing })}''',
     '''        <div className={`flex ${TOOLBAR_NOWRAP ? "" : "flex-wrap"} items-center gap-1 rounded-xl border border-border bg-background/85 p-1 shadow-sm backdrop-blur-sm`}>
          <button
            type="button"
            onClick={() => onSettingsChange({ smoothing: !smoothing })}'''),
])
# The arm, read once, next to the component.
s = open(R + 'components/drawing-canvas.tsx').read()
i = s.index('export default function') if 'export default function' in s else s.index('export function')
s = s[:i] + '''/** The must-fail arm of scripts/verify/assert-rearrange.mjs RA8: the toolbar's
 *  pre-CLOUD-LAYOUT single row. Nothing but that gate sets it. */
const TOOLBAR_NOWRAP = typeof window !== "undefined" && (window as unknown as { __fsToolbarMutant?: string }).__fsToolbarMutant === "nowrap"

''' + s[i:]
open(R + 'components/drawing-canvas.tsx', 'w').write(s)

# 2. THE DOCK'S HEADER WRAPS when the dock is narrow (moved beside a panel):
#    the transport takes a line, the tabs and the actions wrap under it.
edit('components/workspace/dock.css', [
    ('''.fs-dock-theme .dv-groupview[data-fs-dock] > .dv-tabs-and-actions-container {
  height: 36px;''', '''.fs-dock-theme .dv-groupview[data-fs-dock] > .dv-tabs-and-actions-container {
  /* 36 px on one line; narrow (CLOUD-LAYOUT) it wraps and grows, and the
     content below gives the height (dockview's header-aware sizing). */
  height: auto;
  min-height: 36px;
  flex-wrap: wrap;'''),
    ('''.fs-dock-theme .dv-groupview[data-fs-dock] > .dv-tabs-and-actions-container > .dv-pre-actions-container {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
}''', '''.fs-dock-theme .dv-groupview[data-fs-dock] > .dv-tabs-and-actions-container > .dv-pre-actions-container {
  display: flex;
  flex: 1 1 280px;
  min-width: 0;
  min-height: 36px;
}'''),
    ('''.fs-dock-theme .dv-groupview[data-fs-dock] > .dv-tabs-and-actions-container .dv-tabs-container {
  flex: 0 0 auto;''', '''.fs-dock-theme .dv-groupview[data-fs-dock] > .dv-tabs-and-actions-container .dv-tabs-container {
  flex: 0 1 auto;
  min-width: 0;
  height: auto;
  min-height: 36px;
  flex-wrap: wrap;'''),
])

# 3. The transport row docked wraps too: below its line's width the controls go
#    to a second line instead of out of the header.
edit('components/workspace/timeline-panel.tsx', [
    ('''          ? "flex h-full min-w-0 flex-1 items-center gap-x-2 px-2"''',
     '''          ? "flex min-h-full min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1"'''),
    ('''  /** Docked: one row in the dock's header, no wrap, the scrubber gives. */''',
     '''  /** Docked: one row in the dock's header, the scrubber gives; on a dock
   *  narrower than the row (moved beside a panel) it wraps (CLOUD-LAYOUT). */'''),
])
edit('components/dock-shell.tsx', [
    ('''  return <DockHost name="transport" className="flex h-full min-w-0 flex-1 items-center" />''',
     '''  return <DockHost name="transport" className="flex min-h-full min-w-0 flex-1 items-center" />'''),
])
print("ok")

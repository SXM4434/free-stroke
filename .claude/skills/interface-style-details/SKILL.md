---
name: interface-style-details
description: Styling consistency across a UI surface — the biggest tell between "considered" and "thrown together." Use when building or reviewing toolbars, control clusters, icon sets, button groups, cards, or any surface with multiple styled elements. Triggers on borders looking muddy/blurry, icon consistency (fill/stroke/radius mismatch), control bounding shapes, corner-radius consistency, materiality/aesthetic mixing, button fill treatment, stray strokes/hairlines, "looks sloppy", "looks inconsistent", "feels like a bug", "feels thrown together".
---

# Interface style details

Consistency of styling throughout a surface is the biggest tell between something that feels considered and something that feels thrown together. Most "looks off" / "feels like a bug" reactions trace to one element styled differently from its neighbors. Apply when building or reviewing any surface with multiple styled elements.

## Principles

### 1. Borders — outline or shadow, never a solid fill

A border implemented as a solid color looks muddy or blurry over shadows or varied backgrounds. Implement borders as transparent outlines OR box-shadows so they pick up whatever sits behind them — always crisp, with correct contrast in every situation.

```css
/* picks up the background — stays crisp on shadows/varied bg */
box-shadow: 0 0 0 1px rgb(0 0 0 / 0.08);
/* or */
outline: 1px solid rgb(0 0 0 / 0.08);
```

For images on non-white backgrounds, define the image edge with an **inset** border at subtle opacity — subtle, not a hard line.

```css
box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.08);
```

### 2. Iconography — one style, no exceptions

Carelessness shows when icons mix fill style, corner radius, or stroke width. Pick ONE icon style and stick to it across the surface.

### 3. Controls — bounding shapes match

Inconsistent bounding shapes read as a bug. If one control (e.g. the `•••` button) has a bounding shape, sibling controls (e.g. back) should too — or none should. Resolve one of two ways:

- Only primary actions get a bounding shape, OR
- All controls match (all have one, or all have none).

### 4. Corner radius — consistent overall roundedness

Beyond concentric radius (outer = inner + padding): overall roundedness must be consistent across the surface. If a button is fully rounded and a control has generous rounding, then a select-state row or checkbox with a different radius reads sloppy. Match active/selected-row radius to the generous control; fully round the checkboxes.

### 5. Materiality — don't mix aesthetics in one container

Don't drop a flat element (no materiality, high elevation) into a toolbar whose other controls use material / liquid-glass + light. Merging two aesthetics inside one toolbar reads as a visual bug. Pick one material language per container.

### 6. Fills — keep button fill treatment consistent

A secondary button using an outline/ghost style amid filled buttons jumps out. Use a filled style for the secondary button too — kept clearly secondary (lower contrast / weight), but filled like its siblings.

### 7. Strokes — match the stroke language

Strokes and hairlines make components feel "detailed," but in a restrained flat surface a stray stroke (e.g. a white stroke on an avatar) reads as inconsistent — a bug. Match the stroke language across the surface; remove the stray stroke for harmony.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Solid-color border goes muddy/blurry over shadows or varied bg | Use a transparent outline or box-shadow that picks up the background |
| Image edge undefined on non-white bg | Inset border at subtle opacity |
| Icons mix fill/stroke/radius | Pick one icon style, apply everywhere |
| Some controls have a bounding shape, others don't | Shape only on primary actions, OR all match |
| Selected row / checkbox radius differs from the rounded controls | Match active-row radius; fully round checkboxes |
| Flat element dropped into a material/glass toolbar | One material language per container |
| Secondary button is outline/ghost amid filled buttons | Fill it too; keep it clearly secondary |
| Stray stroke (e.g. avatar) on a flat surface | Remove it; match the surface stroke language |

## Review Checklist

- [ ] Borders are outlines/shadows, not solid fills — crisp over any background
- [ ] Images on non-white bg have a subtle inset border
- [ ] All icons share one fill style, corner radius, and stroke width
- [ ] Control bounding shapes are consistent (primary-only or all-match)
- [ ] Roundedness is consistent — rows/checkboxes match the rounded controls
- [ ] One material/aesthetic per container — no flat-in-glass
- [ ] Secondary buttons are filled like their siblings, just clearly secondary
- [ ] No stray strokes/hairlines breaking the surface's stroke language

---

Source: https://www.interfacecraft.dev/library/style-details

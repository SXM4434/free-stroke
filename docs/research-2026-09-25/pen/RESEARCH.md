# The hero's pen against the 08-01 Desk Doodles draw-in, 2026-09-25

Measured only. The online research on variable-width strokes was NOT done: the lane hit its
context line first. Nothing here cites a source it did not open.

## Stroke width on the finished word
`docs/verification/pen/tools/width.mjs`: ink is luma under 128, chamfer distance transform,
width is twice the distance on ridge pixels. Frame 0030 of each 160 ms pick (t = 4.8 s).

| | word px | width p10 / p50 / p90, % of word | p90/p10 | ink share of box | core luma |
|---|---|---|---|---|---|
| reference 08-01, engine Desk Doodles | 714 | 0.84 / 1.68 / 2.15 | 2.56 | 15.3 % | 20.6 |
| hero today, engine Free Stroke (`pen-before`) | 615 | 1.73 / 2.17 / 2.60 | 1.50 | 18.3 % | 21.0 |
| hero, engine Desk Doodles (`pen-probe-dd`) | 615 | 0.98 / 1.73 / 2.38 | 2.44 | 15.7 % | 21.0 |

The reference's line is not thin everywhere. Its median is close to ours; its thin end is half
ours. That is the taper. Ink tone is the same in all three.

## Why, in code
- Desk Doodles Inflate (`lib/dd-engine/strokeTo3d.ts` `buildInflateGeometry`) runs `sin(pi*u)^exp`
  over the WHOLE stroke with a tip at 16 % of the base radius. Every stroke is thin at both ends
  and full only at its middle. The adapter deliberately does not pass `taperSpanDiameters`
  (`lib/dd-engine/adapter.ts`, the block above `closed:`).
- Free Stroke Inflate bounds the taper to a fixed span and fuses the word into one implicit
  field, so most of every stroke sits on a flat plateau: 3.7 % under 90 % of full width against
  65 % on Desk Doodles (the adapter's own 08-28 measurement).

## The moving end, 3x crops (`docs/verification/pen/probe-tip.png`)
Seen: the reference's moving end comes to a point, as if each partial stroke carried its own end
taper. On both of ours the moving end is a flat chop (the k arm, the o of Doodles), and the o shows
a white slit at the moving end. The engine switch does NOT change the moving end; it changes the
finished line. The tip belongs to `lib/pen-reveal.ts` and the viewport's tip field, and F81 records
the six tip shapes drawing indistinguishable pixels.

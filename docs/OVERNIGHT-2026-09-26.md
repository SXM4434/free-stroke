# Overnight 2026-09-26: the queue, in order

He went to sleep at the curve editor merge ("Going to sleep, some working throughout the night").
Rule for tonight: at most 2 browser lanes, sparse clones only, every clone deleted the turn it merges,
nothing merges without its own gate green plus the shared regressions on main.

## Running when he left
1. Full checks on main after the curve editor merge (4b2e21e98): key-lanes 11/11, stroke-strip 18/18,
   perform 12/12, take-timeline 21/21 done green; stroke-timing-browser --grade-solid still running.
2. F122-B (lane/resize): keep the GL viewport equal to the buffer after every resize and export.

## Next, as slots free
3. ANIM-4E Customize (lane/presets): why deleting a saved preset moves the picture (likely F122),
   the leaks probe, the base comparison against main, a screenshot, regressions. Then merge.
4. F123: canvasWidth/canvasHeight go stale after a window resize, so the next render rescales the form.
5. F121: a performed dwell checked on Inflate, Extrude and Solid, not only Rod.
6. Phase 3c: width keys (a geometry rebuild), from DESIGN.md.
7. Phase 5: camera moves, eased and each for a reason (the curve editor already keys the camera; this is
   the named moves and their reasons).

## For him in the morning
A block at the top of docs/STATUS.md: what merged, what to try on localhost, and the calls that are his.

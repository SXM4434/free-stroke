DONE

Commits
- `3155c6069` Plan and scope recorded before edits.
- Step 1, `b59e0bb56`: added the transparent WebM duration row. The plain WebM gate already had a declared-duration check.
- Step 2, `b59e0bb56`: added the animated versus static GLB material row.
- Step 3, `b59e0bb56`: made the alpha encoder reject a submitted frame lost by both streams and added its Node probe.
- Step 4, `b59e0bb56`: wired all three audit breaks into `GATE_MUTATE_FILE` mutants.
- Step 5, `ad70557a1`: recorded gate results and the APNG browser handoff. Removed `.next`; `docs/verification` is absent in this checkout, so there was nothing to restore.

Evidence
- `node_modules/.bin/tsc --noEmit -p .`: 6 errors, the existing `perfect-freehand` error and five `MaskSolidDiagnostics` errors. No new errors.
- `assert-export-formats`: 3 of 3 rows pass; 9 of 9 mutants caught. The new 1 ms duration, magenta basic material, and both-stream frame-loss mutants each reached a summary with the intended new row FAIL.
- `assert-export-webm-alpha`: 6 of 6 rows pass. Its duration row reads 1833.3 ms for 55 frames; the 1 ms control fails. Its frame-loss probe submits three frames, omits timestamp 1000000 us from both mock encoders, and gets `export: both streams lost the frame at 1000.0 ms`; the complete control writes three blocks.
- `assert-export-glb-anim`: 12 of 12 rows pass. The static and animated exports each have two meshes with matching material type, colour, roughness, metalness and texture slots. The magenta basic material control differs.
- `assert-export-gif`: 8 of 8 rows pass.
- `assert-export-encoders`: 8 of 8 rows pass. Its plain WebM row already checks declared duration against the frame count and last frame time.

Browser handoff, note only
At `assert-export-webm-alpha-app.mjs` after the fallback download near line 303, add this paired row. Use the downloaded `f.path`, not the filename, and decode it through the existing `probe` and `frameAt` helpers:

```js
const apng = probe(f.path)
const first = frameAt(f.path, 0)
const last = frameAt(f.path, apng.frames - 1)
const alpha = (rgba, value) => {
  let count = 0
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] === value) count++
  return count
}
const lastHasInk = (rgba) => alpha(rgba, 255) > 0
paired(
  "fallback APNG decodes into multiple transparent frames and ends with visible ink",
  () => apng.ok && apng.frames > 1 && apng.width > 0 && apng.height > 0 &&
    first.length === apng.width * apng.height * 4 && last.length === first.length &&
    alpha(first, 0) > 0 && alpha(last, 0) > 0 && lastHasInk(last) &&
    !first.equals(last),
  "using the first frame as the last shows the finished ink too",
  () => lastHasInk(first),
  `${apng.frames} decoded frames at ${apng.width}x${apng.height}, clean=${apng.ok}`,
)
```

The browser lane should run that row against a real fallback download and confirm its control is false. Browser gates were not run because this job was scoped to Node gates. The GLB fixture has no textures, so the new row checks empty texture slots on this fixture; it does not prove retention of a populated texture.

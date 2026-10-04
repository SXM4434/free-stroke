# CLOUD-REVIEW handoff, 2026-10-04

## Done
- Two read-only reviews in REVIEW.md (87c8904): layout and keyed style, 11 findings; Hand Draw phase 3 and carve, 8 findings. No product file changed.
- LOG.md (261343c): checks, what was not run, owner questions.
- Results, the owner's answers and the merge decision were sent to the local controller session ("Stroke work").

## Owner answers
1. Locked dock (dock-shell.tsx:1079-1080, `locked` + `disableDnd`, nothing can be dragged or resized): fix first. It needs a gate row that really drags a sash, with a must-fail (H6 only measures sash size).
2. Carve AA limited to grazing angles: undecided. Recommendation: limit it.
3. Style keys live in the viewport and export, as their own lane: undecided. Recommendation: yes, it follows from the "keyframe anything" ruling.

## Left
- Where cloud/review merges is the controller's call. LOG.md at the root collides with other lanes; REVIEW.md alone may be what is wanted.
- None of the findings is fixed (read-only job).

## Gates (unchanged snapshot 2cc9e98)
tsc 6 (baseline). keyframes 16/16, 21/21. key-paths 6/7, 8/8 (known EXISTING red). width-keys 12/12, 9/9. camera-moves 11/11, 20/20. flip-pose 8/8, 10/10. stroke-timing 16/16, 12/12 with STROKE_TIMING_BASE=HEAD. Browser gates not run.

The same commits are on cloud/review and on claude/cloud-review-brxw37.

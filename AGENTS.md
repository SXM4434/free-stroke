# Codex, working on Free Stroke until Friday 2026-10-03

Read `docs/HANDOFF-2026-10-01.md` first. Your job is verification and fixing what a gate proves broken. Design calls are his and wait for Friday.

## Do, in this order

1. **Verify `integrate/cloud-1001` in its own folder, `~/.fs-lanes/integrate`** (a sparse clone; node_modules is already there). Start `node_modules/.bin/next dev -p 3138` there, record the pid, and run with `FS_HEADED=0 FS_PORT=3138`:
   - `assert-dock-shell`, `assert-take-transport`, `assert-animation-panel`
   - `assert-key-lanes`, `assert-stroke-strip`, `assert-take-timeline`, `assert-perform`, `assert-resize-settles`
   - `assert-custom-presets`, `assert-motion-customize`, `assert-hand-clock`, `assert-drawin-curve`
   - `assert-flip-slash`, `assert-letters`, `assert-carve-graze`, `assert-export-window`
   - `assert-texture-anim`, `assert-stroke-timing-browser --grade-solid`

   Some gates read untracked base files; copy them from `~/Desktop/Projects/free-stroke/docs/verification/<dir>/` with `cp -p` and `git sparse-checkout add docs/verification/<dir>`. Compare each result with the same gate on main (:3000, read-only). Write every count in a new row at the end of `docs/RUN-QUEUE.md` on the integration branch.
2. **Fix what a gate proves broken**, one commit per fix, on `integrate/cloud-1001`. A red that is main's own (the same row red on :3000) is not yours; write it down. Locators that pointed at the old dock or the Timing popover may need moving to the new panels. Move locators only, never bars.
3. **L1's two open items:** a load at 834x1112 that gave a 834x361 canvas once in six, and the dock-shell must-fails rerun after the last gate edit.
4. **Pictures for him, not verdicts:** screenshots at 1512x982 and 1280x800 of the Draw, Style and Animate workspaces, the rail with a label showing, and the maximized dock with keys. Also a before and after sheet of the carve change on the letter turn. Save them under `docs/verification/integrate-1001/` and list the paths in the row. Do not judge the look; he does.
5. **If all of that is green, and only then:** build export formats (animated GIF, transparent video, animated GLB) in `lib/export/` on a new branch from the integration branch, with gates that decode each file, per `docs/research-2026-09-26/animation-asks-coverage.md` rows 92, 94 and 96.

## Do not

- Merge into `v0/sebastianmmdesign-3308-12049aa9`, switch branches in `~/Desktop/Projects/free-stroke`, or restart or kill the :3000 server. That folder is what he looks at.
- Push anything to `origin` except a `cloud/*` snapshot without `docs/thinking`, per `docs/CLOUD.md`. Never bypass `.githooks/pre-push`, and never use `--no-verify` on a push.
- Make taste or layout decisions, edit `docs/rulings/`, loosen a gate's bar, or delete rows from a gate.
- Build draw-in extras or anything else he will look at, beyond the pictures in step 4. Those wait for Friday.
- Delete any folder (the old lanes are his call), write to `~/Desktop` outside the repo, `pkill -f` a pattern, or run more than two headless browsers at once. Kill servers by exact pid after checking their working directory.
- Use em dashes in code, strings, commits or notes.

## Tools to load, added 2026-10-12

He asked on 2026-10-12 that everything built since 10-02 be hooked up for Free Stroke. The skills live in `~/.claude/skills`. The full table is `~/.fs-lanes/INVENTORY-1012.md`.

- A complaint from him, before any fix: `product-thinking`. Ask first whether his feedback changed a design constraint or is a papercut.
- Any panel or dock change: `break-ui` for worst-case names, 0 and 200 items, then `grid-check` at 1512x982 and 1280x800.
- Any motion change: `animation-performance`, then `python3 ~/lanes/system-1009/programs/motion-perf/animperf.py scan --roots app components lib`.
- Any component restructure: `composition-patterns` and `react-best-practices`.
- A new export format: `validate-idea` first.
- End of a session: `done`.
- The live site is https://v0-free-stroke.vercel.app, built from branch `ship/1012` in `~/.fs-lanes/ship-1012`. Lanes never deploy.

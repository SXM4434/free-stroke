# CL-SHARP

Four film gates `require('sharp')` and sharp is not in package.json:
assert-eye-white-in-ink, assert-eye-letter-overlap, assert-eye-draw-reads-written, assert-eye-s-shape.

## Plan

1. Add sharp as a devDependency with pnpm, the same 0.34.5 that next already pulls in, so the
   lockfile moves by sharp alone.
2. `git diff --stat` and the diff itself: nothing in package.json or pnpm-lock.yaml beyond sharp
   and its dependency tree.
3. Each of the four gates run bare: usage line, exit 2. white-in-ink with `--selftest`.
4. `node_modules/.bin/tsc --noEmit -p .` stays at 6 errors.
5. Commit by pathspec. No push, no next build, no server, no browser.

## Found before the change

- package.json has no `packageManager` field. `node_modules/.modules.yaml` says pnpm laid out the
  tree, and pnpm-lock.yaml is the lockfile it reads. A package-lock.json is also tracked.
- pnpm-lock.yaml already holds sharp@0.34.5 and its @img platform packages, as an optional
  dependency of next.
- This clone's `node_modules/sharp` is a real folder, not a pnpm symlink, so the copied tree
  already resolves sharp by accident. The four gates print usage here before the change. That
  stray folder is the "sharp installed outside the repo" the triage lane saw.

## Control, before the change

With the stray `node_modules/sharp` moved to the session scratchpad, a bare run of
assert-eye-white-in-ink died on `Error: Cannot find module 'sharp'`. That is the crash the brief
names, reproduced, so the green below is pnpm's doing and not the stray copy.

## Done

`pnpm add -D sharp@0.34.5 --prefer-offline`: no download, 340 resolved, 280 reused.
`node_modules/sharp` is now pnpm's symlink to `.pnpm/sharp@0.34.5/node_modules/sharp`.

`git diff --stat`: package.json 1 line, pnpm-lock.yaml 10 lines (6 insertions, 5 deletions).
- package.json: `"sharp": "0.34.5"` in devDependencies, pinned to the version next already uses.
- pnpm-lock.yaml: the sharp importer entry (3 lines), and `optional: true` dropped from three
  snapshots, sharp itself and its own dependencies `@img/colour` and `semver`, because they are now
  reachable through a required edge. Nothing else moved.

| gate | bare exit | first line |
|---|---|---|
| assert-eye-white-in-ink | 2 | usage |
| assert-eye-letter-overlap | 2 | usage |
| assert-eye-draw-reads-written | 2 | usage |
| assert-eye-s-shape | 2 | usage |

`assert-eye-white-in-ink --selftest`: exit 0, "SEES the plants" (clean word 0 px, 3 planted blobs
29 px). `tsc --noEmit -p .`: 6 errors, unchanged.

## Left open

- package-lock.json is tracked and was in step with package.json before this change (same 12
  devDependencies). pnpm does not write it, so it now lacks sharp at the root. Not touched here.
- assert-eye-white-in-ink accepts `--selftest`, but its usage line does not list it.

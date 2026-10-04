# Handoff: layout rethink L3 to L6, K2, K3

Same commits as `cloud/layout-l3`. Full checks in LOG.md.

Done:
- L3, L4, L5, L6, K2: one commit each, gates green except the environment rows noted in LOG.md.
- K3: committed with one open failure.

Gates:
- assert-dock-panels 11/11, assert-workspaces 15/15, assert-maximize 15/15, assert-hit-targets 15/15, assert-keyed-style 13/13.
- assert-key-buttons 11/12: B1 fails, the Dither "Screen angle" slider has no key button.
- tsc at the baseline of 6 errors.

Left:
- Fix B1 (ditherAngle key button) and run the paired regression for K3.
- Owner questions are listed per step in LOG.md.
- Not runnable in the cloud snapshot (base commits missing): drawin-curve, resize-settles, key-lanes row 11, stroke-strip row 0.

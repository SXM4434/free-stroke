# Harness work, parked until the product is done

His call, 2026-10-02: "You can build this stuff out but let's actually finish building the product first." These came from his other sessions (the portfolio controller and the Edge session) as rules for every project. Nothing here is built yet.

## Gaps in Free Stroke's own system (checked against Little Plains, "Agentic Systems Are the Future of Brands")

| Their check | Free Stroke today | To build |
|---|---|---|
| A file that routes: read this first, then this file for this kind of job | Partial: `AGENTS.md` and `docs/HANDOFF-2026-10-01.md` route Codex only, and are dated | One router at the repo root for any agent: what to read first, then which doc for which job (build, gate, ruling, cloud, merge) |
| Rules carry their reason | Yes: rulings quote him with a Why; gate headers say what they guard | Keep |
| One source drives everything downstream | Partial: the style system drives presets, Customize, key paths and ranges; each gate hard-codes its own bars and sizes | Move gate sizes and bars that repeat across gates (main's canvas size, tsc baseline, browser cap) into one config the gates read |
| Tested by a fresh agent with no context | No | Run a fresh agent on a small real task with only the router; every decision it invents becomes a written rule |
| A record of what changed and why, findable by someone new | Yes but heavy: `docs/RUN-QUEUE.md` is past 8,000 lines | An index per feature that points into the ledger |
| Recording his verdict | By hand: the controller writes rulings | Keep, plus a check that every quoted call has a ruling entry |
| Same complaint in different words | No grouping | A list of his complaints by theme, linked to the rulings that answered them |
| A repeat turns into a drafted rule change | No | Draft the rule when a theme repeats, for him to approve |
| Disagreements between rulings | Surfaced by hand (for example letters at 30 degrees against dead on) | A check that flags two rulings that cannot both hold |
| Agent guesses logged | Partial: lanes write questions into ledger rows | Log every guess a lane makes, not just the questions it asks |

## Rules for every project (from the portfolio controller's digests, 2026-10-02)

- **Everything ships as two things:** the real example, and the reusable generator behind it (workflow, skill, script, harness, component) with its parameters exposed, so another product can run it fully customized, never a copy with the names swapped. The biggest reusable thing is a whole workflow. Already done here: `scripts/cloud/snapshot.sh` and `scripts/cloud/start.exp`.
- **Codex carries the bulk** when its quota is live: read-only audits, plans, counts, cold crosschecks, several jobs at once. Claude keeps taste, renders, his calls and merges. Unattended Codex build jobs need his permissions rule first.
- **Lane survival:** a lane starts near 48k context and dies at the 150k gate from reading. Brief it to read one handoff, load no extra skills, and write on its first call. Split planning from building.
- **Graders:** yes/no checks against written rules, never a 1 to 10 score; quote first; swap A and B, and count a win only if it holds both ways.
- **Skill tree:** a main skill with children per product, plus links between them. A pilot runs in the portfolio session first; existing skills stay as they are until he approves it.
- **His standing words:** "always double-check we're not missing stuff or we didn't skip work."

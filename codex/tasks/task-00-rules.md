# Task 00 — Common Rules (MUST)

These rules apply to every task.

## Source of truth (MUST FOLLOW)
- Specs: `docs/specs/**`
- Ops: `AGENTS.md`, `codex/**`
Anything else is not a spec.

## Phase 1 scope (fixed)
Build only:
- Workers API: `/api/inspect`
- Pages Skeleton UI (plain)

No DB. Cache API TTL 24h.

## Prohibitions
- No verdict: “scam/safe/fraud/guaranteed”
- No investment advice
- No scoring/ranking/points
- No extra features not in specs
- No UI beautification
- Do NOT modify `docs/specs/**`

## Explainable requirement
- Output must include reasons and uncertainty
- If data is unavailable, return *why it is unavailable*

## Style
- 1 task = 1 PR
- Minimal diff, minimum working state
- Do not bundle unrelated changes

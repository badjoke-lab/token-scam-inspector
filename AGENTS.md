# AGENTS.md — Token Scam Inspector (Codex Operating Rules)

This file defines the **non-negotiable rules** for Codex implementation.

## Source of truth (MUST FOLLOW)
- ✅ Specs live in: `docs/specs/**`
- ✅ Codex operation rules live in: `AGENTS.md` and `codex/**`
- ❌ Anything else is NOT a spec (including logs and references)

## Phase 1 scope (fixed)
Phase 1 builds **only**:
1) Cloudflare Workers API: `/api/inspect`
2) Cloudflare Pages Skeleton UI (plain, no decoration)

Constraints:
- No DB (Phase 1)
- Cache via Workers Cache API (TTL 24h)

## Hard prohibitions (must never do)
- No verdict language: “scam”, “fraud”, “safe”, “guaranteed”
- No investment advice: “buy/sell”, “should invest”, “avoid buying”
- No scoring, ranking, points, grades
- No unapproved features (auth, accounts, history, paid APIs, DB, etc.)
- No UI beautification (cards, heavy styling, animations, fancy components)
- Do NOT rewrite or modify specs in `docs/specs/**`

## Key principles
- Unknown is not failure
- If data cannot be obtained, return **why** (explainable)
- “Not breaking on free tier” > “high functionality”

## Implementation workflow (mandatory)
- 1 task = 1 PR (small, reviewable diff)
- Always deliver “minimum working state” per step
- Forced order:
  1) Directory structure
  2) Workers hello world + wrangler minimal
  3) `/api/inspect` dummy (fixed JSON)
  4) Cache (TTL 24h)
  5) UI displays dummy JSON
  6) Add inspection checks one by one

## Language rules (API/UI)
Allowed (neutral):
- “risk signal”, “risk indicator”, “potentially risky pattern”
- “unknown”, “insufficient data”, “could not verify”
- “this tool does not provide a verdict”

Forbidden:
- “scam”, “safe”, “fraud”
- “buy/sell”, “invest”

## Docs policy
- Codex may READ any docs.
- Codex must treat `docs/specs/**` as the only spec.
- Codex must NOT edit docs unless a task explicitly allows it.

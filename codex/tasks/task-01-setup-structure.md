# Task 01 — Setup Directory Structure (Phase 1 / Step 1)

## Goal
Create the minimal directory structure and placeholder files to start Phase 1.
Do not implement features or API calls yet.

## Source of truth
Follow: `docs/specs/**` and `AGENTS.md`.

## Allowed changes
- May add/update: `app/**`, `workers/**`, `codex/**`, `README.md` (minimal)
- Must NOT edit: `docs/specs/**` (or any specs)

## Create directories (required)
- `app/`
- `workers/`
- `codex/`
- `codex/tasks/`

## Create minimal placeholder files (required)
### `app/index.html`
- Plain Skeleton UI (no decoration)
- Must include:
  - Title: Token Scam Inspector
  - Neutral subtitle: “Risk signals with explanations. Not a verdict.”
  - Short note: No verdict / no advice
- Mobile-safe (viewport, no horizontal scroll)

### `app/style.css`
- Minimal readability (font, spacing, max-width)
- No fancy components (no cards/animations)

### `app/app.js`
- Empty shell: `"use strict";` and TODO comments only
- No fetch calls yet

### `workers/`
- Can be empty in this task
- Do NOT create `wrangler.toml` yet (reserved for Task 02)

## Optional
### `README.md`
- If needed, add one short note:
  - Pages served from `app/`
  - Workers in `workers/`
Keep it minimal (no new specs).

## Acceptance checklist
- [ ] Required directories exist
- [ ] `app/index.html` opens standalone and shows Skeleton text
- [ ] Mobile-safe (no horizontal scroll)
- [ ] No features added
- [ ] No edits to `docs/specs/**`

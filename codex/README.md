# codex/ — Task Management

This folder is for Codex-driven development workflow.

## Source of truth (specs)
- Specs: `docs/specs/**`
- Codex ops: `AGENTS.md` and `codex/**`

## Workflow
1. Add next task file to `codex/tasks/` (1 task = 1 PR)
2. Codex implements only that task and opens a PR
3. Human reviews (scope, wording, neutrality, free-tier safety)
4. Merge
5. Repeat

## Rules
- Keep tasks small and sequential
- Each task must include:
  - Goal
  - Allowed change scope
  - Deliverables
  - Acceptance checklist

## Task naming
- `task-00-rules.md`
- `task-01-setup-structure.md`
- `task-02-workers-hello.md`
- `task-03-api-dummy.md`
...

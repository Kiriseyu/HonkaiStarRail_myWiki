# Agent Notes

This repository is a monorepo.

- Product frontend: `packages/frontend`（Vue 3，含 `/endgame` 高难配队）
- Optional API: `packages/backend`（NestJS）
- Shared types: `packages/shared`
- Automation: `tests/automation`

## Before changing characters / endgame data

Read:

- `docs/CHARACTER_ADDITIONS.md`

Endgame JSON lives at:

- `packages/frontend/src/data/endgame/`

## Test Automation

Read:

- `tests/automation/README.md`

Run automation from `tests/automation` unless a command says otherwise.

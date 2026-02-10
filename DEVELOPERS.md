# Developer Guide

This document explains the project structure, the architecture standards we follow, and how to extend the app safely.

## Project Overview

Todo Bar is an Electron + React app with Markdown-backed storage. The codebase is split into three strict layers:

1. `src/main` — Electron main process (Node.js environment)
2. `src/renderer` — React UI (browser-like environment)
3. `src/shared` — Type-safe contracts and pure utilities shared by both

Cross-environment imports are not allowed. Renderer code must not import Node/Electron APIs directly.

## Architecture Standards

The following standards are enforced for all refactors and new code:

- **SOLID compliance**
- **Single Responsibility** per module
- **Interface-driven IPC**
- **No cross-process imports**
- **Typed contracts in `/src/shared`**

See `instructions.md` for the full ruleset.

## Key Directories

- `src/main`
  - `main.ts` — app bootstrap
  - `windowManager.ts` — BrowserWindow creation
  - `ipcHandlers.ts` — IPC registrations
  - `todosStore.ts` — Markdown storage + ordering
  - `gitSync.ts` — optional git commits/push
  - `settingsStore.ts` — persisted settings
  - `reminders.ts` — scheduled reminders
  - `rollover.ts` — end-of-day rollover

- `src/renderer`
  - `main.tsx` — React entry
  - `App.tsx` — top-level UI shell
  - `features/todos` — todo list UI + modals
  - `features/settings` — settings modal
  - `styles.css` — UI styles

- `src/shared`
  - `models` — shared data types
  - `ipc` — typed channel constants + bridge types
  - `utils` — date, recurrence, parsing helpers

## IPC Protocol

All IPC channels are defined in `src/shared/ipc/channels.ts` with typed request/response payloads. The renderer uses the preload bridge in `src/shared/ipc/bridge.ts` and never imports Electron.

When adding a new IPC route:

1. Define types + channel in `src/shared/ipc/channels.ts`
2. Update `src/shared/ipc/bridge.ts`
3. Implement handler in `src/main/ipcHandlers.ts`
4. Expose the method from `src/main/preload.ts`

## Renderer Component Rules

- Components are pure functions with explicit props types.
- Local state only where it’s UI-specific.
- No Electron imports in React.
- Feature-first organization, not type-first.

## Data Model

Todos are stored as Markdown files per due date:

- `YYYY-MM-DD.md`
- `undated.md`

Each todo includes a metadata block that preserves fields like:

- `status`, `priority`, `recurrence`, `tags`, `order`
- timestamps: `createdMs`, `updatedMs`

## Git Sync

Git sync is optional and controlled by settings. When enabled, any todo change triggers:

1. `git add .`
2. `git commit -m "<summary>"`
3. `git push` (if a remote is configured)

The latest commit message is shown at the bottom of the UI.

## Drag-and-Drop

DnD is enabled only when sorting by due date. It supports:

- Reordering within a section
- Moving between sections (updates due date)

## Recurrence

Recurring todos support:

- Daily / Weekdays / Weekly / Biweekly / Monthly
- Auto-calculated end date or occurrences
- Preview list of upcoming occurrences

## Running Locally

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
```

Test layout:

- Unit: `src/shared/**/*.test.ts`
- Component: `src/renderer/**/*.test.tsx`

## Build

```bash
npm run build
```

This creates:

- `dist/main/main.js`
- `dist/renderer/`

For packaging releases, use the GitHub Actions workflow or `electron-builder`.

## Development Checklist

- Update `src/shared` contracts before touching IPC
- Add unit tests for new utilities
- Add component tests for UI behavior changes
- Keep main/renderer boundaries strict
- Commit after each logical change

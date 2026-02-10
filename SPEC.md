# Todo Bar Refactor & Migration Spec

Date: 2026-02-10

This spec defines the target architecture, behaviors, UI updates, and tests to complete the migration to the new standards in `instructions.md`. This document must be approved before implementation starts.

## 1. Goals

- Migrate codebase to the required three-layer architecture.
- Preserve all existing functionality.
- Improve filter UX with multi-token AND filtering and text search.
- Add drag-and-drop across sections (updates due date) and reordering within a section.
- Move tabs to the bottom and resolve layout issues (e.g., cropped sort box).
- Keep the app locally testable with unit + component tests.

## 2. Architecture

### 2.1 Folder Layout

- `/src/main`  
  - Electron main process
  - Window lifecycle
  - File system operations
  - Git sync logic
  - Reminder scheduling

- `/src/renderer`  
  - React UI
  - State management (component-local or feature-level)
  - No direct `electron` imports

- `/src/shared`  
  - Type-safe IPC contracts
  - Enums and type definitions
  - Pure utilities shared by main and renderer

### 2.2 IPC Contracts

- All IPC channels defined in `/src/shared/ipc`
- `preload` exposes only typed APIs to renderer
- Main process implements the contract

### 2.3 SOLID Compliance

- Single-responsibility modules by feature or concern
- Inject services via interfaces in `/src/shared`
- Renderer uses abstractions instead of direct IPC access

## 3. Functional Requirements (Preserve Existing)

- Create, edit, delete todos.
- Draft mode for new todo (empty title, placeholder only).
- Editable title and body fields (no losing edit focus).
- Due date editing with overdue highlight.
- Reminders with configurable reminder time.
- Recurring todos:
  - Daily, weekdays, weekly by day, biweekly, monthly
  - Editing recurrence via modal
  - Auto-generate next instance when one is completed
  - Recurrence count and end date auto-calc and preview
  - Delete single instance or all upcoming
  - Instance titles include `(YYYY-MM-DD)` suffix
- Tags:
  - Suggest existing tags
  - Tags stored in metadata
  - Tag chips displayed on each todo
- Git sync (optional):
  - Auto-commit on add/edit/delete/complete
  - Auto-push when a remote is configured
  - Display last commit message in UI

## 4. New/Updated Behaviors

### 4.1 Multi-Token Filtering

- Single input field for filter text.
- Tokenization by comma or whitespace.
- AND semantics across tokens.
- Token types:
  - `#tag` or `tag:foo` → tag filters
  - `todo` / `done` / `deferred` or `status:done` → status filters
  - free text → matches title/body/tags
- If status tokens exist, they override the default tab filter.
- Default view: show Todo items (no filter input).

### 4.2 Drag & Drop

- Todos can be dragged between sections within the Todo tab.
- Dropping into another section updates due date to the target section’s date:
  - Today → today date
  - Tomorrow → tomorrow date
  - This week → drop date at end of week
  - Next week → drop date at next week start (or section label date)
  - Rest → no due date (if the section is “Rest”)
- Reordering within a section is supported and persists.

#### Ordering Storage

- Add a new optional numeric field `order`.
- Order is used when sort key is “due” (default).
- Manual order applies only within a section.
- When sort key is not “due”, ordering is derived from the chosen sort.
- On drag:
  - Update `order` for moved item (and adjust nearby items if needed).
  - If moved across sections, update due date and assign order at end of target section.

### 4.3 Tabs at Bottom

- “Todo” and “Done” tabs move to the bottom of the window.
- Filter and sort remain at the top.
- Ensure no cropping for filter/sort input on narrow widths.

### 4.4 End-of-Day Rollover

- At day boundary:
  - All “today” todos not done move to “tomorrow”
  - Priority becomes high
- Timing: shortly after midnight local time.

## 5. Data Format Changes

- Add `order` in the metadata block.
- Maintain backward compatibility for existing files.

## 6. UI/UX Updates

- Filter input supports multiple tokens and suggestions.
- Sorting control remains visible, not cropped.
- Recurrence button size increased.
- Tag edit button placement near metadata row.
- Description hidden by default; visible on hover or active edit.

## 7. Tests

### 7.1 Unit Tests

- Recurrence date calculation
- Filter token parsing and matching
- Order calculation for drag-and-drop
- Due date update logic for section changes
- Tag normalization and unique constraints

### 7.2 Component Tests (React)

- Todo list rendering and filtering
- Drag and drop behavior (mocked DnD events)
- Recurrence modal behavior
- Tag editing and suggestion behavior
- Tabs (top/bottom) switching

## 8. Migration Plan

1. Introduce new folder structure in `/src` with shared IPC types.
2. Move main process logic into `/src/main`.
3. Replace the renderer with a React app in `/src/renderer`.
4. Implement new filter UI and DnD behaviors.
5. Add tests (Vitest + React Testing Library).
6. Update build scripts and Electron entrypoints.
7. Verify all prior features still work.

## 9. Non-Goals

- End-to-end tests (deferred).
- Changing file storage format beyond adding `order`.
- Changing reminder or Git credential behavior.

## 10. Open Questions (for confirmation)

- For DnD across sections, the exact target date for “This week / Next week / Rest”.
- Whether to add a “manual” sort option to make DnD explicit.
- Whether tag filtering should be case-insensitive (assumed yes).

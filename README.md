# Todo Bar

A lightweight, markdown-backed todo app with optional Git sync.

## Features

- Markdown file storage in your chosen `TODOS` folder.
- Always-on-top, docked sidebar layout with adjustable width and display.
- Quick add, edit, delete, and inline save per item.
- Due date editing with overdue highlight.
- Reminders with configurable daily reminder time.
- Recurring todos: daily, weekdays, weekly, biweekly, monthly.
- Recurrence editing with automatic end-date/occurrence calculation and preview.
- Recurrence instances auto-create the next due date when completed.
- Tags with autocomplete, tag chips, and tag-based filtering.
- Alternating row backgrounds for visual scanning.
- Draft mode for new todos with placeholder title/body.
- End-of-day rollover: overdue items from yesterday move to today and become high priority.
- Optional Git sync with auto-commit + push and last commit message display.

## Data Format

Todos are stored as Markdown files named by due date (e.g., `2026-02-10.md`) plus `undated.md` for items without a due date. Each todo is wrapped in a metadata block that the app reads and writes.

## Running Locally

Prereqs:
- Node.js 18+ recommended.
- macOS, Windows, or Linux.

Install and run:

```bash
npm install
npm run dev
```

## Build For Distribution

This repo does not include a build tool by default. The recommended approach is `electron-builder`.

1. Install a builder:

```bash
npm install --save-dev electron-builder
```

2. Add a minimal build config to `package.json`:

```json
{
  "build": {
    "appId": "com.todo-bar.app",
    "productName": "Todo Bar",
    "files": ["**/*"],
    "mac": { "target": ["dmg"] },
    "win": { "target": ["nsis"] },
    "linux": { "target": ["AppImage"] }
  }
}
```

3. Build on each target OS (recommended):

```bash
npx electron-builder --mac
npx electron-builder --win
npx electron-builder --linux
```

Notes:
- Cross-compiling is limited. For best results, build on the target OS.
- If you want CI builds, add a GitHub Actions workflow for each platform.
  - See `.github/workflows/build.yml` for a ready-to-use workflow.

## Git Sync (Optional)

If enabled, the app will automatically:
- Commit changes on every add/edit/complete/delete.
- Push to the default branch when a remote is configured.
- Show the latest commit message at the bottom of the app.

### Quick Setup

1. Create or choose a todos folder.
2. Initialize a Git repository:

```bash
cd /path/to/TODOS
git init
git add .
git commit -m "Initial commit"
```

3. Add a remote (optional, enables auto-push):

```bash
git remote add origin git@github.com:yourname/your-todos.git
git branch -M main
git push -u origin main
```

4. In the app settings, enable **Git sync**.

### Authentication

This app does not manage Git credentials. Configure auth using:
- SSH keys, or
- a credential manager (for HTTPS + tokens).

Once Git is authenticated, the app will reuse your existing configuration.

## Screenshots

Add your screenshots here and update paths if needed:

![Main View](docs/screenshots/main.png)

![Recurrence Editor](docs/screenshots/recurrence.png)

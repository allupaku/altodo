# Todo Bar

A lightweight, markdown-backed todo app with optional Git sync.

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

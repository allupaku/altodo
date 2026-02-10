import fsSync from 'fs';
import crypto from 'crypto';
import { ensureTodosDir, getTodosDir } from './settingsStore';

export function createTodosWatcher(onChanged: () => void) {
  let watcher: fsSync.FSWatcher | null = null;
  let watcherDir: string | null = null;
  let watchTimer: NodeJS.Timeout | null = null;
  let pollTimer: NodeJS.Timeout | null = null;
  let snapshot: string | null = null;

  async function computeSnapshot() {
    try {
      await ensureTodosDir();
      const entries = fsSync.readdirSync(getTodosDir());
      const hash = crypto.createHash('sha1');
      entries.sort().forEach((name) => {
        if (!name.toLowerCase().endsWith('.md')) return;
        const fullPath = `${getTodosDir()}/${name}`;
        try {
          const stat = fsSync.statSync(fullPath);
          hash.update(`${name}:${stat.mtimeMs}`);
        } catch {
          // ignore missing
        }
      });
      return hash.digest('hex');
    } catch {
      return null;
    }
  }

  async function refreshSnapshot({ notify }: { notify: boolean }) {
    const next = await computeSnapshot();
    if (next === null) return;
    if (next === snapshot) return;
    snapshot = next;
    if (notify) {
      onChanged();
    }
  }

  function stop() {
    watcher?.close();
    watcher = null;
    if (watchTimer) clearTimeout(watchTimer);
    watchTimer = null;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function start() {
    const dir = getTodosDir();
    if (watcher && watcherDir === dir) return;
    stop();
    watcherDir = dir;
    try {
      watcher = fsSync.watch(dir, { persistent: true }, () => {
        if (watchTimer) clearTimeout(watchTimer);
        watchTimer = setTimeout(() => {
          refreshSnapshot({ notify: true }).catch(() => {});
        }, 300);
      });
    } catch {
      watcher = null;
    }
    pollTimer = setInterval(() => {
      refreshSnapshot({ notify: true }).catch(() => {});
    }, 5000);
    refreshSnapshot({ notify: false }).catch(() => {});
  }

  return { start, stop };
}

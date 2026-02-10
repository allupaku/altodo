import { execFile } from 'child_process';
import type { GitStatus } from '../shared/models/settings';

function execGit(args: string[], cwd: string) {
  return new Promise<string>((resolve, reject) => {
    execFile('git', args, { cwd }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(String(stdout || '').trim());
    });
  });
}

async function isGitRepo(dir: string) {
  try {
    const result = await execGit(['rev-parse', '--is-inside-work-tree'], dir);
    return result === 'true';
  } catch {
    return false;
  }
}

async function getGitRemoteNames(dir: string) {
  try {
    const result = await execGit(['remote'], dir);
    return result ? result.split(/\r?\n/).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function getGitDefaultBranch(dir: string, remoteName = 'origin') {
  try {
    const ref = await execGit(['symbolic-ref', `refs/remotes/${remoteName}/HEAD`], dir);
    const parts = ref.split('/');
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

async function getGitLastCommitMessage(dir: string) {
  try {
    return await execGit(['log', '-1', '--pretty=%s'], dir);
  } catch {
    return '';
  }
}

function buildGitCommitArgs(messages: string[]) {
  const filtered = messages.filter(Boolean);
  if (!filtered.length) return null;
  if (filtered.length === 1) {
    return ['commit', '-m', filtered[0]];
  }
  const title = `Update todos (${filtered.length} changes)`;
  const bodyLines = filtered.slice(0, 6).map((msg, index) => `${index + 1}. ${msg}`);
  return ['commit', '-m', title, '-m', bodyLines.join('\n')];
}

export function createGitSync(options: {
  getTodosDir: () => string;
  isEnabled: () => boolean;
  onStatus: (status: GitStatus) => void;
}) {
  let commitTimer: NodeJS.Timeout | null = null;
  let commitInFlight = false;
  let pendingMessages: string[] = [];

  async function getStatus(): Promise<GitStatus> {
    const enabled = options.isEnabled();
    if (!enabled) return { enabled, available: false, message: '' };
    const dir = options.getTodosDir();
    const available = await isGitRepo(dir);
    if (!available) return { enabled, available: false, message: '' };
    const message = await getGitLastCommitMessage(dir);
    return { enabled, available: true, message };
  }

  async function notifyStatus() {
    const status = await getStatus();
    options.onStatus(status);
  }

  function scheduleCommit(message: string) {
    if (!options.isEnabled()) return;
    if (message) pendingMessages.push(message);
    if (commitTimer) return;
    commitTimer = setTimeout(() => {
      commitTimer = null;
      flushCommit().catch(() => {});
    }, 800);
  }

  async function flushCommit() {
    if (commitInFlight) return;
    commitInFlight = true;
    const messages = pendingMessages.splice(0);
    const dir = options.getTodosDir();
    if (!options.isEnabled() || !(await isGitRepo(dir))) {
      commitInFlight = false;
      await notifyStatus();
      return;
    }
    const commitArgs = buildGitCommitArgs(messages);
    if (!commitArgs) {
      commitInFlight = false;
      return;
    }
    try {
      await execGit(['add', '.'], dir);
      const status = await execGit(['status', '--porcelain'], dir);
      if (!status) {
        commitInFlight = false;
        await notifyStatus();
        return;
      }
      await execGit(commitArgs, dir);
      const remotes = await getGitRemoteNames(dir);
      if (remotes.length) {
        const remoteName = remotes[0];
        const defaultBranch = await getGitDefaultBranch(dir, remoteName);
        if (defaultBranch) {
          await execGit(['push', remoteName, `HEAD:refs/heads/${defaultBranch}`], dir);
        } else {
          await execGit(['push', remoteName, 'HEAD'], dir);
        }
      }
    } catch {
      // ignore git failures
    }
    commitInFlight = false;
    await notifyStatus();
  }

  return { scheduleCommit, getStatus, notifyStatus };
}

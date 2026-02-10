const { app, BrowserWindow, ipcMain, screen, Notification } = require('electron');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const fsSync = require('fs');
const fs = require('fs/promises');
const { execFile } = require('child_process');

const DEFAULT_SETTINGS = {
  alwaysOnTop: false,
  dockRight: true,
  widthMode: 'percent',
  widthValue: 25,
  displayId: null,
  todosDir: null,
  reminderTime: '09:00',
  gitEnabled: false,
};

let mainWindow = null;
let settings = { ...DEFAULT_SETTINGS };
let todosWatcher = null;
let todosWatcherDir = null;
let todosWatchTimer = null;
let todosPollTimer = null;
let todosSnapshot = null;
let reminderTimers = new Map();
let reminderPollTimer = null;
let rolloverTimer = null;
let gitCommitTimer = null;
let gitPendingChanges = [];
let gitCommitInFlight = false;

const REMIND_OFFSETS = {
  '5m': 5 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

function getTodosDir() {
  const candidate = settings && typeof settings.todosDir === 'string' ? settings.todosDir.trim() : '';
  if (candidate) return candidate;
  return path.join(os.homedir(), 'TODOS');
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

async function ensureTodosDir() {
  await fs.mkdir(getTodosDir(), { recursive: true });
}

async function loadSettings() {
  await ensureTodosDir();
  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf8');
    const data = JSON.parse(raw);
    settings = { ...DEFAULT_SETTINGS, ...data };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
  if (settings.widthMode !== 'percent') {
    settings.widthMode = 'px';
  }
  if (settings.widthMode === 'percent') {
    const value = Number(settings.widthValue) || 25;
    settings.widthValue = Math.max(10, Math.min(value, 80));
  } else {
    const value = Number(settings.widthValue) || 360;
    settings.widthValue = Math.max(260, value);
  }
  if (settings.todosDir && typeof settings.todosDir !== 'string') {
    settings.todosDir = null;
  }
  if (typeof settings.reminderTime !== 'string' || !/^\d{2}:\d{2}$/.test(settings.reminderTime)) {
    settings.reminderTime = DEFAULT_SETTINGS.reminderTime;
  }
  settings.gitEnabled = Boolean(settings.gitEnabled);
}

async function saveSettings(next) {
  const prevDir = getTodosDir();
  settings = { ...settings, ...next };
  await ensureTodosDir();
  await fs.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2));
  applyWindowPlacement();
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(Boolean(settings.alwaysOnTop));
  }
  if (prevDir !== getTodosDir()) {
    startTodosWatcher();
    scheduleReminders().catch(() => {});
  }
  notifyGitStatus().catch(() => {});
  return settings;
}

function execGit(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(String(stdout || '').trim());
    });
  });
}

async function isGitRepo(dir) {
  try {
    const result = await execGit(['rev-parse', '--is-inside-work-tree'], dir);
    return result === 'true';
  } catch {
    return false;
  }
}

async function getGitRemoteNames(dir) {
  try {
    const result = await execGit(['remote'], dir);
    return result ? result.split(/\r?\n/).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function getGitDefaultBranch(dir, remoteName = 'origin') {
  try {
    const ref = await execGit(['symbolic-ref', `refs/remotes/${remoteName}/HEAD`], dir);
    const parts = ref.split('/');
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

async function getGitLastCommitMessage(dir) {
  try {
    return await execGit(['log', '-1', '--pretty=%s'], dir);
  } catch {
    return '';
  }
}

async function getGitStatus() {
  const enabled = Boolean(settings.gitEnabled);
  if (!enabled) {
    return { enabled, available: false, message: '' };
  }
  const dir = getTodosDir();
  const available = await isGitRepo(dir);
  if (!available) {
    return { enabled, available: false, message: '' };
  }
  const message = await getGitLastCommitMessage(dir);
  return { enabled, available: true, message };
}

async function notifyGitStatus() {
  if (!mainWindow) return;
  const status = await getGitStatus();
  mainWindow.webContents.send('git-status', status);
}

function buildGitCommitArgs(messages) {
  const filtered = messages.filter(Boolean);
  if (!filtered.length) return null;
  if (filtered.length === 1) {
    return ['commit', '-m', filtered[0]];
  }
  const title = `Update todos (${filtered.length} changes)`;
  const bodyLines = filtered.slice(0, 6).map((msg, index) => `${index + 1}. ${msg}`);
  return ['commit', '-m', title, '-m', bodyLines.join('\n')];
}

function scheduleGitCommit(message) {
  if (!settings.gitEnabled) return;
  if (message) {
    gitPendingChanges.push(message);
  }
  if (gitCommitTimer) return;
  gitCommitTimer = setTimeout(() => {
    gitCommitTimer = null;
    flushGitCommit().catch(() => {});
  }, 800);
}

async function flushGitCommit() {
  if (gitCommitInFlight) return;
  gitCommitInFlight = true;
  const messages = gitPendingChanges.splice(0);
  const dir = getTodosDir();
  if (!settings.gitEnabled || !(await isGitRepo(dir))) {
    gitCommitInFlight = false;
    await notifyGitStatus();
    return;
  }
  const commitArgs = buildGitCommitArgs(messages);
  if (!commitArgs) {
    gitCommitInFlight = false;
    return;
  }
  try {
    await execGit(['add', '.'], dir);
    const status = await execGit(['status', '--porcelain'], dir);
    if (!status) {
      gitCommitInFlight = false;
      await notifyGitStatus();
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
  gitCommitInFlight = false;
  await notifyGitStatus();
}

function buildDisplayOptions() {
  const displays = screen.getAllDisplays();
  return displays.map((d, index) => ({
    id: d.id,
    label: `Display ${index + 1} (${d.bounds.width}x${d.bounds.height})`,
    bounds: d.bounds,
    workArea: d.workArea,
  }));
}

function pickDisplay() {
  const displays = screen.getAllDisplays();
  if (!displays.length) return null;
  return (
    displays.find((d) => d.id === settings.displayId) ||
    screen.getPrimaryDisplay()
  );
}

function computeWidth(workArea) {
  const mode = settings.widthMode || 'px';
  let rawValue = Number(settings.widthValue) || (mode === 'percent' ? 30 : 360);
  if (mode === 'percent') {
    rawValue = Math.max(10, Math.min(rawValue, 80));
  } else {
    rawValue = Math.max(260, rawValue);
  }
  const width =
    mode === 'percent' ? Math.round(workArea.width * (rawValue / 100)) : rawValue;
  return Math.max(260, Math.min(width, workArea.width));
}

function applyWindowPlacement() {
  if (!mainWindow) return;
  const display = pickDisplay();
  if (!display) return;

  const work = display.workArea;
  const width = computeWidth(work);
  const height = work.height;
  const current = mainWindow.getBounds();
  const x = settings.dockRight
    ? work.x + work.width - width
    : Math.min(Math.max(current.x, work.x), work.x + work.width - width);
  const y = work.y;

  mainWindow.setBounds({ x, y, width, height });
}

function createWindow() {
  const display = pickDisplay();
  const work = display ? display.workArea : { width: 360, height: 700 };
  const initialWidth = computeWidth(work);
  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: 700,
    minWidth: 260,
    minHeight: 300,
    frame: false,
    transparent: false,
    resizable: true,
    backgroundColor: '#111315',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAlwaysOnTop(Boolean(settings.alwaysOnTop));
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && input.key) {
      const key = input.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        mainWindow.webContents.send('shortcut', 'save');
      }
      if (key === 'n') {
        event.preventDefault();
        mainWindow.webContents.send('shortcut', 'new');
      }
    }
  });

  mainWindow.on('resize', () => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    const displayForBounds = screen.getDisplayMatching(bounds);
    if (settings.widthMode === 'percent') {
      const percent = Math.round((bounds.width / displayForBounds.workArea.width) * 100);
      settings.widthValue = Math.max(10, Math.min(percent, 80));
    } else {
      settings.widthValue = bounds.width;
    }
    fs.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2)).catch(() => {});
    if (settings.dockRight) {
      applyWindowPlacement();
    }
  });

  applyWindowPlacement();
}

async function computeTodosSnapshot() {
  await ensureTodosDir();
  const dir = getTodosDir();
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch {
    return null;
  }
  const parts = [];
  for (const name of entries) {
    if (!name.toLowerCase().endsWith('.md')) continue;
    try {
      const stat = await fs.stat(path.join(dir, name));
      parts.push(`${name}:${stat.mtimeMs}:${stat.size}`);
    } catch {
      // ignore missing files
    }
  }
  parts.sort();
  return parts.join('|');
}

async function refreshTodosSnapshot({ notify } = {}) {
  const next = await computeTodosSnapshot();
  if (next === null) return;
  if (next === todosSnapshot) return;
  todosSnapshot = next;
  if (notify && mainWindow) {
    mainWindow.webContents.send('todos-changed');
  }
  if (notify) {
    scheduleReminders().catch(() => {});
  }
}

function stopTodosWatcher() {
  if (todosWatcher) {
    todosWatcher.close();
    todosWatcher = null;
  }
  if (todosWatchTimer) {
    clearTimeout(todosWatchTimer);
    todosWatchTimer = null;
  }
  if (todosPollTimer) {
    clearInterval(todosPollTimer);
    todosPollTimer = null;
  }
}

function startTodosWatcher() {
  const dir = getTodosDir();
  if (todosWatcher && todosWatcherDir === dir) return;
  stopTodosWatcher();
  todosWatcherDir = dir;
  try {
    todosWatcher = fsSync.watch(dir, { persistent: true }, () => {
      if (todosWatchTimer) clearTimeout(todosWatchTimer);
      todosWatchTimer = setTimeout(() => {
        refreshTodosSnapshot({ notify: true }).catch(() => {});
      }, 300);
    });
  } catch {
    todosWatcher = null;
  }
  todosPollTimer = setInterval(() => {
    refreshTodosSnapshot({ notify: true }).catch(() => {});
  }, 5000);
  refreshTodosSnapshot({ notify: false }).catch(() => {});
}

function reminderTimeFor(todo) {
  if (!todo || !todo.due) return null;
  const offset = REMIND_OFFSETS[todo.remind];
  if (!offset) return null;
  const timeValue =
    typeof settings.reminderTime === 'string' && /^\d{2}:\d{2}$/.test(settings.reminderTime)
      ? settings.reminderTime
      : DEFAULT_SETTINGS.reminderTime;
  const dueDate = new Date(`${todo.due}T${timeValue}:00`);
  if (Number.isNaN(dueDate.getTime())) return null;
  return dueDate.getTime() - offset;
}

function clearReminderTimers() {
  for (const timer of reminderTimers.values()) {
    clearTimeout(timer);
  }
  reminderTimers.clear();
}

async function scheduleReminders() {
  clearReminderTimers();
  if (!Notification.isSupported()) return;
  const todos = await loadAllTodos();
  const now = Date.now();
  const maxDelay = 2_147_483_647;
  todos.forEach((todo) => {
    if (!todo || todo.status === 'done') return;
    const remindAt = reminderTimeFor(todo);
    if (!remindAt || remindAt <= now) return;
    const delay = remindAt - now;
    if (delay > maxDelay) return;
    const key = `${todo.id}:${todo.due}:${todo.remind}`;
    const timer = setTimeout(() => {
      const notification = new Notification({
        title: 'Todo Reminder',
        body: `${todo.title} (due ${todo.due})`,
      });
      notification.show();
      reminderTimers.delete(key);
    }, delay);
    reminderTimers.set(key, timer);
  });
  if (!reminderPollTimer) {
    reminderPollTimer = setInterval(() => {
      scheduleReminders().catch(() => {});
    }, 10 * 60 * 1000);
  }
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDue(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function normalizePriority(value, fallback = 'normal') {
  if (value === 'high') return 'high';
  if (value === 'normal') return 'normal';
  return fallback;
}

function normalizeRecurrence(value, fallback = 'none') {
  if (
    value === 'none' ||
    value === 'daily' ||
    value === 'weekdays' ||
    value === 'monthly' ||
    value === 'biweekly'
  ) {
    return value;
  }
  if (typeof value === 'string' && value.startsWith('weekly:')) {
    const raw = Number(value.split(':')[1]);
    if (Number.isInteger(raw) && raw >= 0 && raw <= 6) {
      return `weekly:${raw}`;
    }
  }
  return fallback;
}

function normalizeRecurrenceCount(value) {
  if (value === null || value === undefined || value === '') return null;
  const count = Number(value);
  if (!Number.isFinite(count)) return null;
  const normalized = Math.floor(count);
  return normalized >= 1 ? normalized : null;
}

function normalizeRecurrenceEnd(value) {
  return normalizeDue(value);
}

function normalizeRecurrenceId(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  value.forEach((tag) => {
    if (typeof tag !== 'string') return;
    const clean = tag.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  });
  return result;
}

function parseDateKey(value) {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function computeNextDue(due, recurrence) {
  const cleanRecurrence = normalizeRecurrence(recurrence, 'none');
  if (cleanRecurrence === 'none') return null;
  const base = parseDateKey(due) || new Date();
  let next = new Date(base);

  if (cleanRecurrence === 'daily') {
    next = addDays(base, 1);
  } else if (cleanRecurrence === 'weekdays') {
    next = addDays(base, 1);
    while (next.getDay() === 0 || next.getDay() === 6) {
      next = addDays(next, 1);
    }
  } else if (cleanRecurrence === 'biweekly') {
    next = addDays(base, 14);
  } else if (cleanRecurrence === 'monthly') {
    const day = base.getDate();
    const month = base.getMonth();
    const year = base.getFullYear();
    const targetMonth = month + 1;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = targetMonth % 12;
    const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
    next = new Date(targetYear, normalizedMonth, Math.min(day, lastDay));
  } else if (cleanRecurrence.startsWith('weekly:')) {
    const targetDay = Number(cleanRecurrence.split(':')[1]);
    const currentDay = base.getDay();
    let delta = (targetDay - currentDay + 7) % 7;
    if (delta === 0) delta = 7;
    next = addDays(base, delta);
  }

  return formatDateKey(next);
}

function stripDateSuffix(title) {
  if (!title) return '';
  return title.replace(/\s*(?:\(|- )\d{4}-\d{2}-\d{2}\)?\s*$/, '').trim();
}

function appendDateSuffix(title, due) {
  if (!due) return title;
  if (title.endsWith(`(${due})`) || title.endsWith(`- ${due}`)) return title;
  const base = stripDateSuffix(title);
  return base ? `${base} (${due})` : `(${due})`;
}

function bucketForDue(due) {
  return due ? `${due}.md` : 'undated.md';
}

function excerptFrom(body) {
  const clean = (body || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length > 110 ? `${clean.slice(0, 110)}…` : clean;
}

function parseBucket(content, fileName, stat) {
  const items = [];
  const regex = /<!--\s*todo:\s*({[\s\S]*?})\s*-->\s*([\s\S]*?)\s*<!--\s*\/todo\s*-->/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const meta = JSON.parse(match[1]);
      const normalized = match[2].replace(/\r\n/g, '\n');
      const lines = normalized.split('\n');
      const markerIndex = lines.findIndex((line) => line.trim() === '---');
      let bodySection =
        markerIndex >= 0 ? lines.slice(markerIndex + 1).join('\n') : normalized;
      if (markerIndex < 0) {
        const hasMetaHeader = lines[0] && lines[0].trim().startsWith('### ');
        const hasMetaLine = lines.some((line) => line.trim().startsWith('- Status:'));
        if (hasMetaHeader && hasMetaLine) {
          bodySection = '';
        }
      }
      const body = bodySection.replace(/\s+$/, '');
      const due = normalizeDue(meta.due);
      const status = typeof meta.status === 'string' ? meta.status : 'todo';
      const remind = typeof meta.remind === 'string' ? meta.remind : 'none';
      const priority = normalizePriority(meta.priority, 'normal');
      const recurrence = normalizeRecurrence(meta.recurrence, 'none');
      const recurrenceEnd = normalizeRecurrenceEnd(meta.recurrenceEnd);
      const recurrenceCount = normalizeRecurrenceCount(meta.recurrenceCount);
      const recurrenceId = normalizeRecurrenceId(meta.recurrenceId);
      const tags = normalizeTags(meta.tags);
      const effectiveRecurrenceId =
        recurrence !== 'none' ? recurrenceId || meta.id : null;
      items.push({
        id: meta.id,
        title: (meta.title || '').trim() || 'Untitled',
        body,
        due,
        status,
        remind,
        priority,
        recurrence,
        recurrenceEnd,
        recurrenceCount,
        recurrenceId: effectiveRecurrenceId,
        tags,
        created: meta.created || null,
        updated: meta.updated || null,
        bucket: fileName,
      });
    } catch {
      // skip invalid block
    }
  }

  if (!items.length) {
    const lines = content.split(/\r?\n/);
    const title = (lines.shift() || '').trim() || fileName.replace(/\.md$/i, '');
    const body = lines.join('\n').replace(/\s+$/, '');
    const fallbackDate = stat ? new Date(stat.mtimeMs).toISOString() : new Date().toISOString();
      items.push({
        id: fileName.replace(/\.md$/i, ''),
        title,
        body,
        due: null,
        status: 'todo',
        remind: 'none',
        priority: 'normal',
        recurrence: 'none',
        recurrenceEnd: null,
        recurrenceCount: null,
        recurrenceId: null,
        tags: [],
        created: fallbackDate,
        updated: fallbackDate,
        bucket: fileName,
        legacy: true,
      });
  }

  return items;
}

function serializeBucket(dateKey, todos) {
  const header = dateKey === 'undated' ? '# Undated Todos' : `# Todos for ${dateKey}`;
  const blocks = todos.map((todo) => {
    const meta = {
      id: todo.id,
      title: todo.title || 'Untitled',
      due: todo.due || null,
      status: todo.status || 'todo',
      remind: todo.remind || 'none',
      priority: normalizePriority(todo.priority, 'normal'),
      recurrence: normalizeRecurrence(todo.recurrence, 'none'),
      recurrenceEnd: normalizeRecurrenceEnd(todo.recurrenceEnd),
      recurrenceCount: normalizeRecurrenceCount(todo.recurrenceCount),
      recurrenceId: normalizeRecurrenceId(todo.recurrenceId),
      tags: normalizeTags(todo.tags),
      created: todo.created || null,
      updated: todo.updated || null,
    };
    const body = (todo.body || '').replace(/\r\n/g, '\n').replace(/\s+$/, '');
    const metaLines = [
      `### ${meta.title}`,
      `- Status: ${meta.status}`,
      `- Priority: ${meta.priority}`,
      `- Repeat: ${meta.recurrence}`,
      `- Repeat end: ${meta.recurrenceEnd || 'None'}`,
      `- Repeat count: ${meta.recurrenceCount || 'None'}`,
      `- Remind: ${meta.remind || 'none'}`,
      `- Due: ${meta.due || 'None'}`,
      `- Tags: ${meta.tags.length ? meta.tags.join(', ') : 'None'}`,
      `- Created: ${meta.created || ''}`,
      `- Updated: ${meta.updated || ''}`,
      '---',
      body,
    ].join('\n');
    return `<!-- todo: ${JSON.stringify(meta)} -->\n${metaLines}\n<!-- /todo -->`;
  });
  return `${header}\n\n${blocks.join('\n\n')}\n`;
}

async function loadAllTodos() {
  await ensureTodosDir();
  const entries = await fs.readdir(getTodosDir());
  const mdFiles = entries.filter((name) => name.toLowerCase().endsWith('.md'));
  const items = [];
  for (const name of mdFiles) {
    const fullPath = path.join(getTodosDir(), name);
    let stat;
    try {
      stat = await fs.stat(fullPath);
    } catch {
      continue;
    }
    let content = '';
    try {
      content = await fs.readFile(fullPath, 'utf8');
    } catch {
      continue;
    }
    const parsed = parseBucket(content, name, stat);
    items.push(...parsed);
  }
  return items;
}

function compareDue(a, b) {
  if (a.due && b.due) return a.due.localeCompare(b.due);
  if (a.due && !b.due) return -1;
  if (!a.due && b.due) return 1;
  return 0;
}

async function listTodos() {
  const items = await loadAllTodos();
  return items.map((todo) => ({
    id: todo.id,
    title: todo.title,
    due: todo.due,
    status: todo.status || 'todo',
    remind: todo.remind || 'none',
    priority: todo.priority || 'normal',
    recurrence: todo.recurrence || 'none',
    recurrenceEnd: todo.recurrenceEnd || null,
    recurrenceCount: typeof todo.recurrenceCount === 'number' ? todo.recurrenceCount : null,
    tags: Array.isArray(todo.tags) ? todo.tags : [],
    createdMs: todo.created ? Date.parse(todo.created) : null,
    updatedMs: todo.updated ? Date.parse(todo.updated) : null,
    excerpt: excerptFrom(todo.body),
  }));
}

async function readTodo(id) {
  const items = await loadAllTodos();
  const found = items.find((todo) => todo.id === id);
  if (!found) return null;
  return {
    id: found.id,
    title: found.title,
    body: found.body || '',
    due: found.due,
    status: found.status || 'todo',
    remind: found.remind || 'none',
    priority: found.priority || 'normal',
    recurrence: found.recurrence || 'none',
    recurrenceEnd: found.recurrenceEnd || null,
    recurrenceCount: typeof found.recurrenceCount === 'number' ? found.recurrenceCount : null,
    tags: Array.isArray(found.tags) ? found.tags : [],
    created: found.created || null,
  };
}

async function readBucket(name) {
  const fullPath = path.join(getTodosDir(), name);
  try {
    const stat = await fs.stat(fullPath);
    const content = await fs.readFile(fullPath, 'utf8');
    return parseBucket(content, name, stat);
  } catch {
    return [];
  }
}

async function writeBucket(name, todos) {
  const fullPath = path.join(getTodosDir(), name);
  if (!todos.length) {
    try {
      await fs.unlink(fullPath);
    } catch {
      // ignore missing
    }
    return;
  }
  const dateKey = name.replace(/\.md$/i, '');
  const content = serializeBucket(dateKey, todos);
  await fs.writeFile(fullPath, content, 'utf8');
}

async function saveTodo({
  id,
  title,
  body,
  due,
  status,
  remind,
  priority,
  recurrence,
  recurrenceEnd,
  recurrenceCount,
  recurrenceId,
  tags,
}) {
  await ensureTodosDir();
  const now = new Date().toISOString();
  const items = await loadAllTodos();
  const existing = id ? items.find((todo) => todo.id === id) : null;
  const prevStatus = existing ? existing.status || 'todo' : 'todo';
  const nextId = id || crypto.randomUUID();
  const safeTitle = (title || '').trim() || 'Untitled';
  const cleanBody = typeof body === 'string' ? body.replace(/\r\n/g, '\n') : '';
  const cleanDue = normalizeDue(due);
  let cleanStatus = typeof status === 'string' ? status : existing?.status || 'todo';
  if (!['todo', 'done', 'deferred'].includes(cleanStatus)) {
    cleanStatus = 'todo';
  }
  const cleanRemind = typeof remind === 'string' ? remind : existing?.remind || 'none';
  const cleanPriority = normalizePriority(priority, existing?.priority || 'normal');
  const cleanRecurrence = normalizeRecurrence(recurrence, existing?.recurrence || 'none');
  let cleanRecurrenceEnd = normalizeRecurrenceEnd(
    recurrenceEnd !== undefined ? recurrenceEnd : existing?.recurrenceEnd
  );
  let cleanRecurrenceCount = normalizeRecurrenceCount(
    recurrenceCount !== undefined ? recurrenceCount : existing?.recurrenceCount
  );
  const cleanRecurrenceId = normalizeRecurrenceId(
    recurrenceId !== undefined ? recurrenceId : existing?.recurrenceId
  );
  const cleanTags = normalizeTags(tags !== undefined ? tags : existing?.tags);
  if (cleanRecurrence === 'none') {
    cleanRecurrenceEnd = null;
    cleanRecurrenceCount = null;
  }
  const effectiveRecurrenceId =
    cleanRecurrence === 'none' ? null : cleanRecurrenceId || existing?.id || nextId;
  const storedTitle =
    cleanRecurrence !== 'none' && cleanDue ? appendDateSuffix(safeTitle, cleanDue) : safeTitle;
  const targetBucket = bucketForDue(cleanDue);
  const oldBucket = existing ? existing.bucket : null;

  if (oldBucket && oldBucket !== targetBucket) {
    const oldItems = await readBucket(oldBucket);
    const remaining = oldItems.filter((todo) => todo.id !== nextId);
    await writeBucket(oldBucket, remaining);
  }

  const bucketItems = await readBucket(targetBucket);
  const filtered = bucketItems.filter((todo) => todo.id !== nextId);
  filtered.push({
    id: nextId,
    title: storedTitle,
    body: cleanBody,
    due: cleanDue,
    status: cleanStatus,
    remind: cleanRemind,
    priority: cleanPriority,
    recurrence: cleanRecurrence,
    recurrenceEnd: cleanRecurrenceEnd,
    recurrenceCount: cleanRecurrenceCount,
    recurrenceId: effectiveRecurrenceId,
    tags: cleanTags,
    created: existing ? existing.created || now : now,
    updated: now,
  });
  filtered.sort((a, b) => {
    const dueCmp = compareDue(a, b);
    if (dueCmp !== 0) return dueCmp;
    const aUpdated = a.updated ? Date.parse(a.updated) : 0;
    const bUpdated = b.updated ? Date.parse(b.updated) : 0;
    return bUpdated - aUpdated;
  });
  await writeBucket(targetBucket, filtered);

  const changeAction = !existing
    ? 'Add'
    : prevStatus !== 'done' && cleanStatus === 'done'
      ? 'Complete'
      : prevStatus === 'done' && cleanStatus !== 'done'
        ? 'Reopen'
        : 'Update';
  const changeTitle = stripDateSuffix(storedTitle) || 'Untitled';
  scheduleGitCommit(`${changeAction} todo: ${changeTitle}`);

  if (prevStatus !== 'done' && cleanStatus === 'done' && cleanRecurrence !== 'none') {
    const baseDue = cleanDue || existing?.due || formatDateKey(new Date());
    const nextDue = computeNextDue(baseDue, cleanRecurrence);
    const hasRemaining = cleanRecurrenceCount === null || cleanRecurrenceCount > 1;
    const withinEnd = !cleanRecurrenceEnd || (nextDue && nextDue <= cleanRecurrenceEnd);
    if (nextDue && hasRemaining && withinEnd) {
      const nextCount =
        cleanRecurrenceCount === null ? null : Math.max(1, cleanRecurrenceCount - 1);
      const nextTitle = appendDateSuffix(stripDateSuffix(storedTitle), nextDue);
      await saveTodo({
        id: null,
        title: nextTitle,
        body: cleanBody,
        due: nextDue,
        status: 'todo',
        remind: cleanRemind,
        priority: cleanPriority,
        recurrence: cleanRecurrence,
        recurrenceEnd: cleanRecurrenceEnd,
        recurrenceCount: nextCount,
        recurrenceId: effectiveRecurrenceId,
        tags: cleanTags,
      });
    }
  }

  scheduleReminders().catch(() => {});
  return { id: nextId };
}

async function deleteTodo(id) {
  await ensureTodosDir();
  const items = await loadAllTodos();
  const existing = items.find((todo) => todo.id === id);
  if (!existing) return false;
  const bucket = existing.bucket;
  const bucketItems = await readBucket(bucket);
  const remaining = bucketItems.filter((todo) => todo.id !== id);
  await writeBucket(bucket, remaining);
  scheduleGitCommit(`Delete todo: ${stripDateSuffix(existing.title) || 'Untitled'}`);
  scheduleReminders().catch(() => {});
  return true;
}

async function deleteTodoSeries(id) {
  await ensureTodosDir();
  const items = await loadAllTodos();
  const existing = items.find((todo) => todo.id === id);
  if (!existing) return false;
  const seriesId =
    existing.recurrenceId || (existing.recurrence !== 'none' ? existing.id : null);
  if (!seriesId) {
    return deleteTodo(id);
  }
  const cutoff = existing.due || null;
  const remaining = [];
  for (const todo of items) {
    if (todo.recurrenceId !== seriesId) {
      remaining.push(todo);
      continue;
    }
    if (!cutoff) {
      continue;
    }
    if (!todo.due) {
      continue;
    }
    if (todo.due < cutoff) {
      remaining.push(todo);
    }
  }
  const buckets = new Map();
  for (const todo of remaining) {
    if (!buckets.has(todo.bucket)) buckets.set(todo.bucket, []);
    buckets.get(todo.bucket).push(todo);
  }
  const bucketNames = new Set(items.map((todo) => todo.bucket));
  for (const name of bucketNames) {
    const bucketItems = buckets.get(name) || [];
    await writeBucket(name, bucketItems);
  }
  scheduleGitCommit(`Delete series: ${stripDateSuffix(existing.title) || 'Untitled'}`);
  scheduleReminders().catch(() => {});
  return true;
}

async function rolloverTodosToToday() {
  const todayKey = formatDateKey(new Date());
  const yesterdayKey = formatDateKey(addDays(new Date(), -1));
  const items = await loadAllTodos();
  const candidates = items.filter(
    (todo) => todo.due === yesterdayKey && todo.status !== 'done'
  );
  if (!candidates.length) return false;
  for (const todo of candidates) {
    await saveTodo({
      id: todo.id,
      title: todo.title,
      body: todo.body || '',
      due: todayKey,
      status: todo.status || 'todo',
      remind: todo.remind || 'none',
      priority: 'high',
      recurrence: todo.recurrence || 'none',
      recurrenceEnd: todo.recurrenceEnd || null,
      recurrenceCount: typeof todo.recurrenceCount === 'number' ? todo.recurrenceCount : null,
      tags: Array.isArray(todo.tags) ? todo.tags : [],
    });
  }
  return true;
}

function scheduleDailyRollover() {
  if (rolloverTimer) {
    clearTimeout(rolloverTimer);
  }
  const now = new Date();
  const next = new Date(now);
  next.setHours(0, 0, 5, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  const delay = Math.max(1000, next.getTime() - now.getTime());
  rolloverTimer = setTimeout(async () => {
    try {
      await rolloverTodosToToday();
    } catch {
      // ignore rollover failures
    }
    scheduleDailyRollover();
  }, delay);
}

app.whenReady().then(async () => {
  await loadSettings();
  if (settings.displayId === null) {
    settings.displayId = screen.getPrimaryDisplay().id;
  }
  createWindow();
  startTodosWatcher();
  scheduleReminders().catch(() => {});
  rolloverTodosToToday().catch(() => {});
  scheduleDailyRollover();
  notifyGitStatus().catch(() => {});

  screen.on('display-added', () => {
    if (mainWindow) {
      mainWindow.webContents.send('displays-changed');
      applyWindowPlacement();
    }
  });

  screen.on('display-removed', () => {
    if (mainWindow) {
      mainWindow.webContents.send('displays-changed');
      applyWindowPlacement();
    }
  });

  screen.on('display-metrics-changed', () => {
    if (mainWindow) {
      mainWindow.webContents.send('displays-changed');
      applyWindowPlacement();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('todos:list', async () => listTodos());
ipcMain.handle('todos:read', async (_evt, id) => readTodo(id));
ipcMain.handle('todos:save', async (_evt, payload) => saveTodo(payload));
ipcMain.handle('todos:delete', async (_evt, id) => deleteTodo(id));
ipcMain.handle('todos:delete-series', async (_evt, id) => deleteTodoSeries(id));
ipcMain.handle('git:status', async () => getGitStatus());

ipcMain.handle('settings:get', async () => settings);
ipcMain.handle('settings:set', async (_evt, next) => saveSettings(next));
ipcMain.handle('displays:list', async () => buildDisplayOptions());

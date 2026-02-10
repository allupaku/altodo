import { app } from 'electron';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AppSettings } from '../shared/models/settings';

export const DEFAULT_SETTINGS: AppSettings = {
  alwaysOnTop: false,
  dockRight: true,
  widthMode: 'percent',
  widthValue: 25,
  displayId: null,
  todosDir: null,
  reminderTime: '09:00',
  gitEnabled: false,
};

let settings: AppSettings = { ...DEFAULT_SETTINGS };

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function getTodosDir() {
  const candidate = settings.todosDir ? settings.todosDir.trim() : '';
  if (candidate) return candidate;
  return path.join(os.homedir(), 'TODOS');
}

export function getSettings() {
  return settings;
}

function sanitizeSettings(next: Partial<AppSettings>): AppSettings {
  const merged = { ...DEFAULT_SETTINGS, ...next };
  if (merged.widthMode !== 'percent') {
    merged.widthMode = 'px';
  }
  if (merged.widthMode === 'percent') {
    const value = Number(merged.widthValue) || 25;
    merged.widthValue = Math.max(10, Math.min(value, 80));
  } else {
    const value = Number(merged.widthValue) || 360;
    merged.widthValue = Math.max(260, value);
  }
  if (merged.todosDir && typeof merged.todosDir !== 'string') {
    merged.todosDir = null;
  }
  if (typeof merged.reminderTime !== 'string' || !/^\d{2}:\d{2}$/.test(merged.reminderTime)) {
    merged.reminderTime = DEFAULT_SETTINGS.reminderTime;
  }
  merged.gitEnabled = Boolean(merged.gitEnabled);
  merged.alwaysOnTop = Boolean(merged.alwaysOnTop);
  merged.dockRight = Boolean(merged.dockRight);
  return merged;
}

export async function ensureTodosDir() {
  await fs.mkdir(getTodosDir(), { recursive: true });
}

export async function loadSettings() {
  await ensureTodosDir();
  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf8');
    const data = JSON.parse(raw) as Partial<AppSettings>;
    settings = sanitizeSettings(data);
  } catch {
    settings = sanitizeSettings(DEFAULT_SETTINGS);
  }
  return settings;
}

export async function saveSettings(next: Partial<AppSettings>) {
  const prevDir = getTodosDir();
  settings = sanitizeSettings({ ...settings, ...next });
  await ensureTodosDir();
  await fs.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2));
  return { settings, prevDir, nextDir: getTodosDir() };
}

import { app, BrowserWindow, globalShortcut, screen } from 'electron';
import * as path from 'path';
import { loadSettings, getSettings, getTodosDir } from './settingsStore';
import { createWindowManager } from './windowManager';
import { createGitSync } from './gitSync';
import { createReminderScheduler } from './reminders';
import { registerIpcHandlers } from './ipcHandlers';
import { createTodosWatcher } from './todosWatcher';
import { createRollover } from './rollover';
import { IPC_EVENTS } from '../shared/ipc/channels';
import { listTodos } from './todosStore';

const devServerUrl = process.env.VITE_DEV_SERVER_URL || '';
const isDev = Boolean(devServerUrl);

let mainWindow: BrowserWindow | null = null;

function main() {
  const windowManager = createWindowManager({
    getSettings,
    isDev,
    devServerUrl,
    preloadPath: path.join(__dirname, 'preload.js'),
  });

  const gitSync = createGitSync({
    getTodosDir,
    isEnabled: () => Boolean(getSettings().gitEnabled),
    onStatus: (status) => {
      if (mainWindow) {
        mainWindow.webContents.send(IPC_EVENTS.GIT_STATUS, status);
      }
    },
  });

  const reminders = createReminderScheduler({
    getSettings,
    listTodos,
  });

  const todosWatcher = createTodosWatcher(() => {
    if (mainWindow) {
      mainWindow.webContents.send(IPC_EVENTS.TODOS_CHANGED);
    }
  });

  const rollover = createRollover({
    scheduleCommit: gitSync.scheduleCommit,
  });

  registerIpcHandlers({
    gitSync,
    reminders,
    windowManager,
    onTodosChanged: () => {
      if (mainWindow) {
        mainWindow.webContents.send(IPC_EVENTS.TODOS_CHANGED);
      }
    },
    onSettingsChanged: () => {
      todosWatcher.start();
    },
  });

  mainWindow = windowManager.createWindow();
  todosWatcher.start();
  reminders.scheduleReminders().catch(() => {});
  rollover.scheduleDailyRollover();
  gitSync.notifyStatus().catch(() => {});

  screen.on('display-added', () => {
    if (mainWindow) {
      mainWindow.webContents.send(IPC_EVENTS.DISPLAYS_CHANGED);
      windowManager.applyWindowPlacement();
    }
  });

  screen.on('display-removed', () => {
    if (mainWindow) {
      mainWindow.webContents.send(IPC_EVENTS.DISPLAYS_CHANGED);
      windowManager.applyWindowPlacement();
    }
  });

  globalShortcut.register('CommandOrControl+N', () => {
    mainWindow?.webContents.send(IPC_EVENTS.SHORTCUT, { action: 'new' });
  });
  globalShortcut.register('CommandOrControl+S', () => {
    mainWindow?.webContents.send(IPC_EVENTS.SHORTCUT, { action: 'save' });
  });
}

app.whenReady().then(async () => {
  await loadSettings();
  main();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      main();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

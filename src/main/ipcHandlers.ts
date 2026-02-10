import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc/channels';
import type { AppSettings } from '../shared/models/settings';
import type { TodoSavePayload } from '../shared/models/todo';
import type { createGitSync } from './gitSync';
import type { createReminderScheduler } from './reminders';
import type { createWindowManager } from './windowManager';
import * as todosStore from './todosStore';
import * as settingsStore from './settingsStore';

interface IpcHandlerDeps {
  gitSync: ReturnType<typeof createGitSync>;
  reminders: ReturnType<typeof createReminderScheduler>;
  windowManager: ReturnType<typeof createWindowManager>;
  onTodosChanged: () => void;
  onSettingsChanged: () => void;
}

export function registerIpcHandlers(deps: IpcHandlerDeps) {
  ipcMain.handle(IPC_CHANNELS.TODOS_LIST, async () => todosStore.listTodos());
  ipcMain.handle(IPC_CHANNELS.TODOS_READ, async (_evt, id: string) => todosStore.readTodo(id));
  ipcMain.handle(IPC_CHANNELS.TODOS_SAVE, async (_evt, payload: TodoSavePayload) => {
    const result = await todosStore.saveTodo(payload, deps.gitSync.scheduleCommit);
    await deps.reminders.scheduleReminders();
    deps.onTodosChanged();
    return result;
  });
  ipcMain.handle(IPC_CHANNELS.TODOS_DELETE, async (_evt, id: string) => {
    const result = await todosStore.deleteTodo(id, deps.gitSync.scheduleCommit);
    await deps.reminders.scheduleReminders();
    deps.onTodosChanged();
    return result;
  });
  ipcMain.handle(IPC_CHANNELS.TODOS_DELETE_SERIES, async (_evt, id: string) => {
    const result = await todosStore.deleteTodoSeries(id, deps.gitSync.scheduleCommit);
    await deps.reminders.scheduleReminders();
    deps.onTodosChanged();
    return result;
  });
  ipcMain.handle(
    IPC_CHANNELS.TODOS_MOVE_DUE,
    async (_evt, payload: { id: string; due: string | null; order?: number | null }) => {
      const result = await todosStore.moveTodoToDue(
        payload.id,
        payload.due,
        payload.order ?? null,
        deps.gitSync.scheduleCommit
      );
      await deps.reminders.scheduleReminders();
      deps.onTodosChanged();
      return result;
    }
  );
  ipcMain.handle(IPC_CHANNELS.TODOS_REORDER, async (_evt, ids: string[]) => {
    await todosStore.reorderTodos(ids, deps.gitSync.scheduleCommit);
    deps.onTodosChanged();
    return true;
  });
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => settingsStore.getSettings());
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_evt, next: Partial<AppSettings>) => {
    const { settings, prevDir, nextDir } = await settingsStore.saveSettings(next);
    if (prevDir !== nextDir) {
      deps.onSettingsChanged();
    }
    deps.windowManager.applyWindowPlacement();
    if (deps.windowManager.getMainWindow()) {
      deps.windowManager.getMainWindow()!.setAlwaysOnTop(Boolean(settings.alwaysOnTop));
    }
    await deps.reminders.scheduleReminders();
    await deps.gitSync.notifyStatus();
    return settings;
  });
  ipcMain.handle(IPC_CHANNELS.DISPLAYS_LIST, async () => deps.windowManager.buildDisplayOptions());
  ipcMain.handle(IPC_CHANNELS.GIT_STATUS, async () => deps.gitSync.getStatus());
}

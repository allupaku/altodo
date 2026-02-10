import { contextBridge, ipcRenderer } from 'electron';
import type { TodoApi } from '../shared/ipc/bridge';

type ChannelsModule = typeof import('../shared/ipc/channels');
// Preload runs in a sandboxed context; prefer a local copy, fallback to dist/shared for dev.
function loadChannels(): ChannelsModule {
  try {
    return require('./shared/ipc/channels') as ChannelsModule;
  } catch {
    return require('../shared/ipc/channels') as ChannelsModule;
  }
}
const { IPC_CHANNELS, IPC_EVENTS } = loadChannels();

const api: TodoApi = {
  listTodos: () => ipcRenderer.invoke(IPC_CHANNELS.TODOS_LIST),
  readTodo: (id) => ipcRenderer.invoke(IPC_CHANNELS.TODOS_READ, id),
  saveTodo: (payload) => ipcRenderer.invoke(IPC_CHANNELS.TODOS_SAVE, payload),
  deleteTodo: (id) => ipcRenderer.invoke(IPC_CHANNELS.TODOS_DELETE, id),
  deleteTodoSeries: (id) => ipcRenderer.invoke(IPC_CHANNELS.TODOS_DELETE_SERIES, id),
  moveTodoDue: (id, due, order) => ipcRenderer.invoke(IPC_CHANNELS.TODOS_MOVE_DUE, { id, due, order }),
  reorderTodos: (ids) => ipcRenderer.invoke(IPC_CHANNELS.TODOS_REORDER, ids),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (next) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, next),
  listDisplays: () => ipcRenderer.invoke(IPC_CHANNELS.DISPLAYS_LIST),
  getGitStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GIT_STATUS),
  onDisplaysChanged: (cb) => ipcRenderer.on(IPC_EVENTS.DISPLAYS_CHANGED, cb),
  onTodosChanged: (cb) => ipcRenderer.on(IPC_EVENTS.TODOS_CHANGED, cb),
  onShortcut: (cb) => ipcRenderer.on(IPC_EVENTS.SHORTCUT, (_evt, payload) => cb(payload.action)),
  onGitStatus: (cb) => ipcRenderer.on(IPC_EVENTS.GIT_STATUS, (_evt, status) => cb(status)),
};

contextBridge.exposeInMainWorld('todoApi', api);

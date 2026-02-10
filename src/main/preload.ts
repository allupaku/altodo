import { contextBridge, ipcRenderer } from 'electron';
import type { TodoApi } from '../shared/ipc/bridge';

type ChannelsType = typeof import('../shared/ipc/channels').IPC_CHANNELS;
type EventsType = typeof import('../shared/ipc/channels').IPC_EVENTS;

// Inline channels for preload to avoid sandboxed require resolution issues.
const IPC_CHANNELS: ChannelsType = {
  TODOS_LIST: 'todos:list',
  TODOS_READ: 'todos:read',
  TODOS_SAVE: 'todos:save',
  TODOS_DELETE: 'todos:delete',
  TODOS_DELETE_SERIES: 'todos:delete-series',
  TODOS_MOVE_DUE: 'todos:move-due',
  TODOS_REORDER: 'todos:reorder',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  DISPLAYS_LIST: 'displays:list',
  GIT_STATUS: 'git:status',
};

const IPC_EVENTS: EventsType = {
  TODOS_CHANGED: 'todos-changed',
  DISPLAYS_CHANGED: 'displays-changed',
  SHORTCUT: 'shortcut',
  GIT_STATUS: 'git-status',
};

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

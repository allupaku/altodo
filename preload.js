const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('todoApi', {
  listTodos: () => ipcRenderer.invoke('todos:list'),
  readTodo: (id) => ipcRenderer.invoke('todos:read', id),
  saveTodo: (payload) => ipcRenderer.invoke('todos:save', payload),
  deleteTodo: (id) => ipcRenderer.invoke('todos:delete', id),
  deleteTodoSeries: (id) => ipcRenderer.invoke('todos:delete-series', id),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (next) => ipcRenderer.invoke('settings:set', next),
  listDisplays: () => ipcRenderer.invoke('displays:list'),
  onDisplaysChanged: (cb) => ipcRenderer.on('displays-changed', cb),
  onShortcut: (cb) => ipcRenderer.on('shortcut', (_evt, action) => cb(action)),
  onTodosChanged: (cb) => ipcRenderer.on('todos-changed', cb),
  getGitStatus: () => ipcRenderer.invoke('git:status'),
  onGitStatus: (cb) => ipcRenderer.on('git-status', (_evt, status) => cb(status)),
});

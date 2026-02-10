import type { AppSettings, DisplayInfo, GitStatus } from '../models/settings';
import type { TodoDetail, TodoListItem, TodoSavePayload } from '../models/todo';

export const IPC_CHANNELS = {
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
} as const;

export const IPC_EVENTS = {
  TODOS_CHANGED: 'todos-changed',
  DISPLAYS_CHANGED: 'displays-changed',
  SHORTCUT: 'shortcut',
  GIT_STATUS: 'git-status',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
export type IpcEvent = (typeof IPC_EVENTS)[keyof typeof IPC_EVENTS];

export interface IpcContracts {
  [IPC_CHANNELS.TODOS_LIST]: {
    request: void;
    response: TodoListItem[];
  };
  [IPC_CHANNELS.TODOS_READ]: {
    request: string;
    response: TodoDetail | null;
  };
  [IPC_CHANNELS.TODOS_SAVE]: {
    request: TodoSavePayload;
    response: { id: string };
  };
  [IPC_CHANNELS.TODOS_DELETE]: {
    request: string;
    response: boolean;
  };
  [IPC_CHANNELS.TODOS_DELETE_SERIES]: {
    request: string;
    response: boolean;
  };
  [IPC_CHANNELS.TODOS_MOVE_DUE]: {
    request: { id: string; due: string | null };
    response: { id: string } | null;
  };
  [IPC_CHANNELS.TODOS_REORDER]: {
    request: string[];
    response: boolean;
  };
  [IPC_CHANNELS.SETTINGS_GET]: {
    request: void;
    response: AppSettings;
  };
  [IPC_CHANNELS.SETTINGS_SET]: {
    request: Partial<AppSettings>;
    response: AppSettings;
  };
  [IPC_CHANNELS.DISPLAYS_LIST]: {
    request: void;
    response: DisplayInfo[];
  };
  [IPC_CHANNELS.GIT_STATUS]: {
    request: void;
    response: GitStatus;
  };
}

export interface ShortcutPayload {
  action: 'new' | 'save';
}

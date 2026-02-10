import type { AppSettings, DisplayInfo, GitStatus } from '../models/settings';
import type { TodoDetail, TodoListItem, TodoSavePayload } from '../models/todo';
import type { ShortcutPayload } from './channels';

export interface TodoApi {
  listTodos: () => Promise<TodoListItem[]>;
  readTodo: (id: string) => Promise<TodoDetail | null>;
  saveTodo: (payload: TodoSavePayload) => Promise<{ id: string }>;
  deleteTodo: (id: string) => Promise<boolean>;
  deleteTodoSeries: (id: string) => Promise<boolean>;
  moveTodoDue: (id: string, due: string | null) => Promise<{ id: string } | null>;
  reorderTodos: (ids: string[]) => Promise<boolean>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (next: Partial<AppSettings>) => Promise<AppSettings>;
  listDisplays: () => Promise<DisplayInfo[]>;
  getGitStatus: () => Promise<GitStatus>;
  onDisplaysChanged: (cb: () => void) => void;
  onTodosChanged: (cb: () => void) => void;
  onShortcut: (cb: (action: ShortcutPayload['action']) => void) => void;
  onGitStatus: (cb: (status: GitStatus) => void) => void;
}

export interface WindowWithApi extends Window {
  todoApi: TodoApi;
}

import { Notification } from 'electron';
import type { AppSettings } from '../shared/models/settings';
import type { TodoListItem } from '../shared/models/todo';

const REMIND_OFFSETS: Record<string, number> = {
  '5m': 5 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

export function createReminderScheduler(options: {
  getSettings: () => AppSettings;
  listTodos: () => Promise<TodoListItem[]>;
}) {
  const reminderTimers = new Map<string, NodeJS.Timeout>();
  let pollTimer: NodeJS.Timeout | null = null;

  function reminderTimeFor(todo: TodoListItem, settings: AppSettings) {
    if (!todo || !todo.due) return null;
    const offset = REMIND_OFFSETS[todo.remind];
    if (!offset) return null;
    const timeValue =
      typeof settings.reminderTime === 'string' && /^\d{2}:\d{2}$/.test(settings.reminderTime)
        ? settings.reminderTime
        : '09:00';
    const dueDate = new Date(`${todo.due}T${timeValue}:00`);
    if (Number.isNaN(dueDate.getTime())) return null;
    return dueDate.getTime() - offset;
  }

  function clearReminders() {
    for (const timer of reminderTimers.values()) {
      clearTimeout(timer);
    }
    reminderTimers.clear();
  }

  async function scheduleReminders() {
    clearReminders();
    if (!Notification.isSupported()) return;
    const todos = await options.listTodos();
    const now = Date.now();
    const settings = options.getSettings();
    const maxDelay = 2_147_483_647;
    todos.forEach((todo) => {
      if (!todo || todo.status === 'done') return;
      const remindAt = reminderTimeFor(todo, settings);
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
    if (!pollTimer) {
      pollTimer = setInterval(() => {
        scheduleReminders().catch(() => {});
      }, 10 * 60 * 1000);
    }
  }

  return { scheduleReminders };
}

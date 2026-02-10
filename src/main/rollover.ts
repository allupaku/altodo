import { addDays, formatDateKey } from '../shared/utils/date';
import { listTodos, readTodo, saveTodo } from './todosStore';

export function createRollover(options: { scheduleCommit: (message: string) => void }) {
  let rolloverTimer: NodeJS.Timeout | null = null;

  async function rolloverTodayToTomorrow() {
    const todayKey = formatDateKey(new Date());
    const tomorrowKey = formatDateKey(addDays(new Date(), 1));
    const items = await listTodos();
    const candidates = items.filter((todo) => todo.due === todayKey && todo.status !== 'done');
    if (!candidates.length) return false;
    for (const todo of candidates) {
      const detail = await readTodo(todo.id);
      if (!detail) continue;
      await saveTodo(
        {
          id: detail.id,
          title: detail.title,
          body: detail.body,
          due: tomorrowKey,
          status: detail.status,
          remind: detail.remind,
          priority: 'high',
          recurrence: detail.recurrence,
          recurrenceEnd: detail.recurrenceEnd,
          recurrenceCount: detail.recurrenceCount,
          tags: detail.tags,
          order: detail.order,
        },
        options.scheduleCommit
      );
    }
    return true;
  }

  function scheduleDailyRollover() {
    if (rolloverTimer) clearTimeout(rolloverTimer);
    const now = new Date();
    const next = new Date(now);
    next.setHours(0, 0, 5, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    const delay = Math.max(1000, next.getTime() - now.getTime());
    rolloverTimer = setTimeout(async () => {
      try {
        await rolloverTodayToTomorrow();
      } catch {
        // ignore
      }
      scheduleDailyRollover();
    }, delay);
  }

  return { rolloverTodayToTomorrow, scheduleDailyRollover };
}

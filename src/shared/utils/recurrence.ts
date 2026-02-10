import { addDays, formatDateKey, parseDateKey } from './date';
import type { RecurrenceRule } from '../models/todo';

export function computeNextDue(due: string | null, recurrence: RecurrenceRule) {
  if (!recurrence || recurrence === 'none') return null;
  const base = parseDateKey(due) || new Date();
  let next = new Date(base);

  if (recurrence === 'daily') {
    next = addDays(base, 1);
  } else if (recurrence === 'weekdays') {
    next = addDays(base, 1);
    while (next.getDay() === 0 || next.getDay() === 6) {
      next = addDays(next, 1);
    }
  } else if (recurrence === 'biweekly') {
    next = addDays(base, 14);
  } else if (recurrence === 'monthly') {
    const day = base.getDate();
    const month = base.getMonth();
    const year = base.getFullYear();
    const targetMonth = month + 1;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = targetMonth % 12;
    const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
    next = new Date(targetYear, normalizedMonth, Math.min(day, lastDay));
  } else if (recurrence.startsWith('weekly:')) {
    const targetDay = Number(recurrence.split(':')[1]);
    const currentDay = base.getDay();
    let delta = (targetDay - currentDay + 7) % 7;
    if (delta === 0) delta = 7;
    next = addDays(base, delta);
  }

  return formatDateKey(next);
}

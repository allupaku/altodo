import type { RecurrenceRule, TodoListItem, TodoStatus } from '../../../shared/models/todo';
import type { EditCache, SectionConfig, SortKey, TabKey } from './types';
import { addDays, formatDateKey } from '../../../shared/utils/date';
import { computeNextDue } from '../../../shared/utils/recurrence';

export function formatDate(ms: number | null) {
  if (!ms) return '';
  const date = new Date(ms);
  return date.toLocaleString();
}

export function statusLabel(status: TodoStatus) {
  if (status === 'done') return 'Done';
  if (status === 'deferred') return 'Deferred';
  return 'Todo';
}

export function remindLabel(value: string) {
  if (value === '5m') return 'Remind 5 minutes before';
  if (value === '30m') return 'Remind 30 minutes before';
  if (value === '1h') return 'Remind 1 hour before';
  if (value === '1d') return 'Remind 1 day before';
  return '';
}

export function recurrenceLabel(value: RecurrenceRule) {
  if (!value || value === 'none') return '';
  if (value === 'daily') return 'Repeats daily';
  if (value === 'weekdays') return 'Repeats weekdays';
  if (value === 'biweekly') return 'Repeats every 2 weeks';
  if (value === 'monthly') return 'Repeats monthly';
  if (value.startsWith('weekly:')) {
    const day = Number(value.split(':')[1]);
    const labels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const label = labels[Number.isNaN(day) ? 0 : day] || 'Sunday';
    return `Repeats ${label}`;
  }
  return '';
}

export function compareDue(a: TodoListItem, b: TodoListItem) {
  if (a.due && b.due) return a.due.localeCompare(b.due);
  if (a.due && !b.due) return -1;
  if (!a.due && b.due) return 1;
  return 0;
}

export function compareTitle(a: TodoListItem, b: TodoListItem) {
  return (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
}

export function compareCreated(a: TodoListItem, b: TodoListItem) {
  const aMs = a.createdMs || 0;
  const bMs = b.createdMs || 0;
  return bMs - aMs;
}

export function compareUpdated(a: TodoListItem, b: TodoListItem) {
  const aMs = a.updatedMs || 0;
  const bMs = b.updatedMs || 0;
  return bMs - aMs;
}

export function sortItems(items: TodoListItem[], sortKey: SortKey, tab: TabKey) {
  return items.slice().sort((a, b) => {
    if (tab === 'todo') {
      const aPriority = a.priority === 'high' ? 0 : 1;
      const bPriority = b.priority === 'high' ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      const aRank = a.status === 'deferred' ? 0 : 1;
      const bRank = b.status === 'deferred' ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
    }
    if (sortKey === 'title') return compareTitle(a, b);
    if (sortKey === 'created') return compareCreated(a, b);
    if (sortKey === 'updated') return compareUpdated(a, b);
    const dueCmp = compareDue(a, b);
    if (dueCmp !== 0) return dueCmp;
    const orderA = a.order ?? Number.POSITIVE_INFINITY;
    const orderB = b.order ?? Number.POSITIVE_INFINITY;
    if (orderA !== orderB) return orderA - orderB;
    return compareUpdated(a, b);
  });
}

export function isDoneInDoneTab(todo: TodoListItem) {
  return todo.status === 'done';
}

export function getSectionKey(
  todo: TodoListItem,
  todayKey: string,
  tomorrowKey: string,
  endOfWeekKey: string,
  nextWeekKey: string,
  isFriday: boolean
) {
  if (!todo.due) return 'rest';
  if (todo.due === todayKey) return 'today';
  if (isFriday) {
    if (todo.due > todayKey && todo.due <= nextWeekKey) return 'nextWeek';
    return 'rest';
  }
  if (todo.due === tomorrowKey) return 'tomorrow';
  if (todo.due > tomorrowKey && todo.due <= endOfWeekKey) return 'thisWeek';
  return 'rest';
}

export function buildSections(today: Date) {
  const todayKey = formatDateKey(today);
  const tomorrowKey = formatDateKey(addDays(today, 1));
  const endOfWeekKey = formatDateKey(addDays(today, (7 - today.getDay()) % 7));
  const nextWeekKey = formatDateKey(addDays(today, 7));
  const isFriday = today.getDay() === 5;
  const sections: SectionConfig[] = isFriday
    ? [
        { key: 'today', label: 'Due today', targetDue: todayKey },
        { key: 'nextWeek', label: 'Due next week', targetDue: nextWeekKey },
        { key: 'rest', label: 'Rest of todos', targetDue: null },
      ]
    : [
        { key: 'today', label: 'Due today', targetDue: todayKey },
        { key: 'tomorrow', label: 'Due tomorrow', targetDue: tomorrowKey },
        { key: 'thisWeek', label: 'Due by end of the week', targetDue: endOfWeekKey },
        { key: 'rest', label: 'Rest of todos', targetDue: null },
      ];
  return { sections, todayKey, tomorrowKey, endOfWeekKey, nextWeekKey, isFriday };
}

export function parseRecurrenceCount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const count = Number(value);
  if (!Number.isFinite(count)) return null;
  const normalized = Math.floor(count);
  return normalized >= 1 ? normalized : null;
}

export function computeEndDateFromCount(
  baseDue: string | null,
  recurrence: RecurrenceRule,
  count: string | number | null | undefined
) {
  const normalized = parseRecurrenceCount(count);
  if (!normalized || normalized <= 1) return baseDue || null;
  let current = baseDue || formatDateKey(new Date());
  for (let i = 1; i < normalized; i += 1) {
    const next = computeNextDue(current, recurrence);
    if (!next) return current;
    current = next;
  }
  return current;
}

export function computeCountFromEndDate(
  baseDue: string | null,
  recurrence: RecurrenceRule,
  endDate: string | null
) {
  if (!baseDue || !endDate || !recurrence || recurrence === 'none') return null;
  let count = 1;
  let current = baseDue;
  while (current && current < endDate) {
    const next = computeNextDue(current, recurrence);
    if (!next || next <= current) break;
    current = next;
    count += 1;
    if (count > 500) break;
  }
  return current === endDate ? count : null;
}

export function updateRepeatPreview(
  baseDue: string | null,
  repeatValue: RecurrenceRule,
  endDateValue: string | null,
  endCountValue: string | number | null
) {
  if (!repeatValue || repeatValue === 'none') {
    return '';
  }
  const dates: string[] = [];
  let current = baseDue || formatDateKey(new Date());
  const max = 4;
  dates.push(current);
  for (let i = 1; i < max; i += 1) {
    const next = computeNextDue(current, repeatValue);
    if (!next) break;
    dates.push(next);
    current = next;
  }
  const hasCount = parseRecurrenceCount(endCountValue) !== null;
  const hasEndDate = Boolean(endDateValue);
  const limit = hasEndDate
    ? endDateValue
    : hasCount
      ? computeEndDateFromCount(baseDue, repeatValue, endCountValue)
      : null;
  const limitLabel = limit ? `Ends ${limit}` : 'No end';
  return `Preview: ${dates.join(' -> ')} - ${limitLabel}`;
}

export interface FilterTokens {
  tagTokens: string[];
  textTokens: string[];
  statusTokens: TodoStatus[];
}

export function parseFilterTokens(value: string): FilterTokens {
  const raw = value.trim();
  if (!raw) {
    return { tagTokens: [], textTokens: [], statusTokens: [] };
  }
  const tokens = raw.match(/[^\s,]+/g) || [];
  const tagTokens: string[] = [];
  const textTokens: string[] = [];
  const statusTokens: TodoStatus[] = [];
  tokens.forEach((token) => {
    const lower = token.toLowerCase();
    if (lower === 'todo' || lower === 'done' || lower === 'deferred') {
      statusTokens.push(lower as TodoStatus);
      return;
    }
    if (lower.startsWith('status:')) {
      const status = lower.slice(7);
      if (status === 'todo' || status === 'done' || status === 'deferred') {
        statusTokens.push(status as TodoStatus);
        return;
      }
    }
    if (lower.startsWith('#') || lower.startsWith('tag:')) {
      return;
    }
    textTokens.push(lower);
  });
  return {
    tagTokens: uniqueTokens(tagTokens),
    textTokens: uniqueTokens(textTokens),
    statusTokens: uniqueTokens(statusTokens) as TodoStatus[],
  };
}

function uniqueTokens<T extends string>(tokens: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];
  tokens.forEach((token) => {
    const key = token.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(token);
  });
  return result;
}

export function matchesStatusFilter(status: TodoStatus, tokens: TodoStatus[]) {
  if (!tokens.length) return true;
  return tokens.includes(status);
}

export function matchesTagFilter(tags: string[], tokens: string[]) {
  if (!tokens.length) return true;
  const lowered = tags.map((tag) => tag.toLowerCase());
  return tokens.every((token) => lowered.includes(token.toLowerCase()));
}

export function matchesTextFilter(text: string, tokens: string[]) {
  if (!tokens.length) return true;
  const lowered = text.toLowerCase();
  return tokens.every((token) => lowered.includes(token.toLowerCase()));
}

export function buildSearchText(todo: TodoListItem, cache?: EditCache | null) {
  const title = cache?.title || todo.title || '';
  const body = cache?.body || todo.excerpt || '';
  return `${title} ${body}`.toLowerCase();
}

export function collectAllTags(todos: TodoListItem[]) {
  const tags: string[] = [];
  todos.forEach((todo) => {
    if (Array.isArray(todo.tags)) {
      tags.push(...todo.tags);
    }
  });
  return uniqueTokens(tags);
}

export interface BatchTodoDraft {
  title: string;
  due: string | null;
  tags: string[];
}

function normalizeBatchTags(value: string) {
  return value
    .split(/[,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeDueToken(value: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

export function parseBatchInput(text: string, fallbackDue: string | null): BatchTodoDraft[] {
  const lines = text.split(/\r?\n/);
  const items: BatchTodoDraft[] = [];
  lines.forEach((line) => {
    const raw = line.trim();
    if (!raw) return;
    let working = raw;
    let due: string | null = null;
    const dateMatch = working.match(/@(\d{4}-\d{2}-\d{2})\s*$/);
    if (dateMatch) {
      const parsed = normalizeDueToken(dateMatch[1]);
      if (parsed) {
        due = parsed;
        working = working.slice(0, dateMatch.index).trim();
      }
    }
    const tags: string[] = [];
    const tagRegex = /\/tags:([^\n]+)/gi;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = tagRegex.exec(working)) !== null) {
      tags.push(...normalizeBatchTags(tagMatch[1]));
    }
    working = working.replace(tagRegex, '').trim();
    const title = working.replace(/\s+/g, ' ').trim();
    if (!title) return;
    items.push({
      title,
      due: due ?? fallbackDue,
      tags: uniqueTokens(tags),
    });
  });
  return items;
}

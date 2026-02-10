import type { RecurrenceRule, TodoPriority, TodoStatus } from '../models/todo';

export function normalizeDue(input: string | null | undefined) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

export function normalizePriority(value: string | null | undefined, fallback: TodoPriority = 'normal') {
  if (value === 'high') return 'high';
  if (value === 'normal') return 'normal';
  return fallback;
}

export function normalizeStatus(value: string | null | undefined, fallback: TodoStatus = 'todo') {
  if (value === 'todo' || value === 'done' || value === 'deferred') return value;
  return fallback;
}

export function normalizeRecurrence(value: string | null | undefined, fallback: RecurrenceRule = 'none') {
  if (
    value === 'none' ||
    value === 'daily' ||
    value === 'weekdays' ||
    value === 'monthly' ||
    value === 'biweekly'
  ) {
    return value;
  }
  if (typeof value === 'string' && value.startsWith('weekly:')) {
    const raw = Number(value.split(':')[1]);
    if (Number.isInteger(raw) && raw >= 0 && raw <= 6) {
      return `weekly:${raw}` as RecurrenceRule;
    }
  }
  return fallback;
}

export function normalizeRecurrenceCount(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const count = Number(value);
  if (!Number.isFinite(count)) return null;
  const normalized = Math.floor(count);
  return normalized >= 1 ? normalized : null;
}

export function normalizeRecurrenceEnd(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;
  return normalizeDue(value);
}

export function normalizeRecurrenceId(value: unknown) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  value.forEach((tag) => {
    if (typeof tag !== 'string') return;
    const clean = tag.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  });
  return result;
}

export function normalizeOrder(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

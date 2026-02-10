import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { computeNextDue } from '../shared/utils/recurrence';
import { formatDateKey } from '../shared/utils/date';
import {
  normalizeDue,
  normalizeOrder,
  normalizePriority,
  normalizeRecurrence,
  normalizeRecurrenceCount,
  normalizeRecurrenceEnd,
  normalizeRecurrenceId,
  normalizeStatus,
  normalizeTags,
} from '../shared/utils/normalize';
import type { TodoDetail, TodoListItem, TodoSavePayload } from '../shared/models/todo';
import { getTodosDir, ensureTodosDir } from './settingsStore';

interface StoredTodo {
  id: string;
  title: string;
  body: string;
  due: string | null;
  status: string;
  remind: string;
  priority: string;
  recurrence: string;
  recurrenceEnd: string | null;
  recurrenceCount: number | null;
  recurrenceId: string | null;
  tags: string[];
  created: string | null;
  updated: string | null;
  order: number | null;
  bucket: string;
  legacy?: boolean;
}

const META_REGEX = /<!--\s*todo:\s*({[\s\S]*?})\s*-->\s*([\s\S]*?)\s*<!--\s*\/todo\s*-->/g;

function bucketForDue(due: string | null) {
  return due ? `${due}.md` : 'undated.md';
}

function stripDateSuffix(title: string) {
  if (!title) return '';
  return title.replace(/\s*(?:\(|- )\d{4}-\d{2}-\d{2}\)?\s*$/, '').trim();
}

function appendDateSuffix(title: string, due: string | null) {
  if (!due) return title;
  if (title.endsWith(`(${due})`) || title.endsWith(`- ${due}`)) return title;
  const base = stripDateSuffix(title);
  return base ? `${base} (${due})` : `(${due})`;
}

function excerptFrom(body: string) {
  const clean = (body || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length > 110 ? `${clean.slice(0, 110)}…` : clean;
}

function parseBucket(content: string, fileName: string, stat?: { mtimeMs: number }) {
  const items: StoredTodo[] = [];
  let match: RegExpExecArray | null;
  while ((match = META_REGEX.exec(content)) !== null) {
    try {
      const meta = JSON.parse(match[1]);
      const normalized = match[2].replace(/\r\n/g, '\n');
      const lines = normalized.split('\n');
      const markerIndex = lines.findIndex((line) => line.trim() === '---');
      let bodySection = markerIndex >= 0 ? lines.slice(markerIndex + 1).join('\n') : normalized;
      if (markerIndex < 0) {
        const hasMetaHeader = lines[0] && lines[0].trim().startsWith('### ');
        const hasMetaLine = lines.some((line) => line.trim().startsWith('- Status:'));
        if (hasMetaHeader && hasMetaLine) {
          bodySection = '';
        }
      }
      const body = bodySection.replace(/\s+$/, '');
      const due = normalizeDue(meta.due);
      const status = normalizeStatus(meta.status, 'todo');
      const remind = typeof meta.remind === 'string' ? meta.remind : 'none';
      const priority = normalizePriority(meta.priority, 'normal');
      const recurrence = normalizeRecurrence(meta.recurrence, 'none');
      const recurrenceEnd = normalizeRecurrenceEnd(meta.recurrenceEnd);
      const recurrenceCount = normalizeRecurrenceCount(meta.recurrenceCount);
      const recurrenceId = normalizeRecurrenceId(meta.recurrenceId);
      const tags = normalizeTags(meta.tags);
      const order = normalizeOrder(meta.order);
      const effectiveRecurrenceId = recurrence !== 'none' ? recurrenceId || meta.id : null;
      items.push({
        id: meta.id,
        title: (meta.title || '').trim() || 'Untitled',
        body,
        due,
        status,
        remind,
        priority,
        recurrence,
        recurrenceEnd,
        recurrenceCount,
        recurrenceId: effectiveRecurrenceId,
        tags,
        order,
        created: meta.created || null,
        updated: meta.updated || null,
        bucket: fileName,
      });
    } catch {
      // ignore invalid block
    }
  }

  if (!items.length) {
    const lines = content.split(/\r?\n/);
    const title = (lines.shift() || '').trim() || fileName.replace(/\.md$/i, '');
    const body = lines.join('\n').replace(/\s+$/, '');
    const fallbackDate = stat ? new Date(stat.mtimeMs).toISOString() : new Date().toISOString();
    items.push({
      id: fileName.replace(/\.md$/i, ''),
      title,
      body,
      due: null,
      status: 'todo',
      remind: 'none',
      priority: 'normal',
      recurrence: 'none',
      recurrenceEnd: null,
      recurrenceCount: null,
      recurrenceId: null,
      tags: [],
      order: null,
      created: fallbackDate,
      updated: fallbackDate,
      bucket: fileName,
      legacy: true,
    });
  }

  return items;
}

function serializeBucket(dateKey: string, todos: StoredTodo[]) {
  const header = dateKey === 'undated' ? '# Undated Todos' : `# Todos for ${dateKey}`;
  const blocks = todos.map((todo) => {
    const meta = {
      id: todo.id,
      title: todo.title || 'Untitled',
      due: todo.due || null,
      status: todo.status || 'todo',
      remind: todo.remind || 'none',
      priority: normalizePriority(todo.priority, 'normal'),
      recurrence: normalizeRecurrence(todo.recurrence, 'none'),
      recurrenceEnd: normalizeRecurrenceEnd(todo.recurrenceEnd),
      recurrenceCount: normalizeRecurrenceCount(todo.recurrenceCount),
      recurrenceId: normalizeRecurrenceId(todo.recurrenceId),
      tags: normalizeTags(todo.tags),
      order: normalizeOrder(todo.order),
      created: todo.created || null,
      updated: todo.updated || null,
    };
    const body = (todo.body || '').replace(/\r\n/g, '\n').replace(/\s+$/, '');
    const metaLines = [
      `### ${meta.title}`,
      `- Status: ${meta.status}`,
      `- Priority: ${meta.priority}`,
      `- Repeat: ${meta.recurrence}`,
      `- Repeat end: ${meta.recurrenceEnd || 'None'}`,
      `- Repeat count: ${meta.recurrenceCount || 'None'}`,
      `- Remind: ${meta.remind || 'none'}`,
      `- Due: ${meta.due || 'None'}`,
      `- Tags: ${meta.tags.length ? meta.tags.join(', ') : 'None'}`,
      `- Order: ${meta.order ?? 'None'}`,
      `- Created: ${meta.created || ''}`,
      `- Updated: ${meta.updated || ''}`,
      '---',
      body,
    ].join('\n');
    return `<!-- todo: ${JSON.stringify(meta)} -->\n${metaLines}\n<!-- /todo -->`;
  });
  return `${header}\n\n${blocks.join('\n\n')}\n`;
}

async function readBucket(name: string) {
  const fullPath = path.join(getTodosDir(), name);
  try {
    const stat = await fs.stat(fullPath);
    const content = await fs.readFile(fullPath, 'utf8');
    return parseBucket(content, name, stat);
  } catch {
    return [] as StoredTodo[];
  }
}

async function writeBucket(name: string, todos: StoredTodo[]) {
  const fullPath = path.join(getTodosDir(), name);
  if (!todos.length) {
    try {
      await fs.unlink(fullPath);
    } catch {
      // ignore
    }
    return;
  }
  const dateKey = name.replace(/\.md$/i, '');
  const content = serializeBucket(dateKey, todos);
  await fs.writeFile(fullPath, content, 'utf8');
}

async function loadAllTodos() {
  await ensureTodosDir();
  const entries = await fs.readdir(getTodosDir());
  const mdFiles = entries.filter((name) => name.toLowerCase().endsWith('.md'));
  const items: StoredTodo[] = [];
  for (const name of mdFiles) {
    const fullPath = path.join(getTodosDir(), name);
    let stat: { mtimeMs: number } | undefined;
    try {
      stat = await fs.stat(fullPath);
    } catch {
      continue;
    }
    let content = '';
    try {
      content = await fs.readFile(fullPath, 'utf8');
    } catch {
      continue;
    }
    items.push(...parseBucket(content, name, stat));
  }
  return items;
}

function compareDue(a: StoredTodo, b: StoredTodo) {
  if (a.due && b.due) return a.due.localeCompare(b.due);
  if (a.due && !b.due) return -1;
  if (!a.due && b.due) return 1;
  return 0;
}

export async function listTodos(): Promise<TodoListItem[]> {
  const items = await loadAllTodos();
  return items.map((todo) => ({
    id: todo.id,
    title: todo.title,
    due: todo.due,
    status: normalizeStatus(todo.status, 'todo'),
    remind: todo.remind || 'none',
    priority: normalizePriority(todo.priority, 'normal'),
    recurrence: normalizeRecurrence(todo.recurrence, 'none'),
    recurrenceEnd: normalizeRecurrenceEnd(todo.recurrenceEnd),
    recurrenceCount: normalizeRecurrenceCount(todo.recurrenceCount),
    tags: normalizeTags(todo.tags),
    createdMs: todo.created ? Date.parse(todo.created) : null,
    updatedMs: todo.updated ? Date.parse(todo.updated) : null,
    excerpt: excerptFrom(todo.body),
    order: normalizeOrder(todo.order),
  }));
}

export async function readTodo(id: string): Promise<TodoDetail | null> {
  const items = await loadAllTodos();
  const found = items.find((todo) => todo.id === id);
  if (!found) return null;
  return {
    id: found.id,
    title: found.title,
    body: found.body || '',
    due: found.due,
    status: normalizeStatus(found.status, 'todo'),
    remind: found.remind || 'none',
    priority: normalizePriority(found.priority, 'normal'),
    recurrence: normalizeRecurrence(found.recurrence, 'none'),
    recurrenceEnd: normalizeRecurrenceEnd(found.recurrenceEnd),
    recurrenceCount: normalizeRecurrenceCount(found.recurrenceCount),
    tags: normalizeTags(found.tags),
    createdMs: found.created ? Date.parse(found.created) : null,
    updatedMs: found.updated ? Date.parse(found.updated) : null,
    excerpt: excerptFrom(found.body),
    order: normalizeOrder(found.order),
    created: found.created || null,
  };
}

export async function saveTodo(payload: TodoSavePayload, scheduleNext: (message: string) => void) {
  await ensureTodosDir();
  const now = new Date().toISOString();
  const items = await loadAllTodos();
  const existing = payload.id ? items.find((todo) => todo.id === payload.id) : null;
  const prevStatus = existing ? normalizeStatus(existing.status, 'todo') : 'todo';
  const nextId = payload.id || crypto.randomUUID();
  const safeTitle = (payload.title || '').trim() || 'Untitled';
  const cleanBody = typeof payload.body === 'string' ? payload.body.replace(/\r\n/g, '\n') : '';
  const cleanDue = normalizeDue(payload.due);
  let cleanStatus = normalizeStatus(payload.status, existing?.status ? normalizeStatus(existing.status, 'todo') : 'todo');
  const cleanRemind = typeof payload.remind === 'string' ? payload.remind : existing?.remind || 'none';
  const cleanPriority = normalizePriority(payload.priority, existing?.priority ? normalizePriority(existing.priority, 'normal') : 'normal');
  const cleanRecurrence = normalizeRecurrence(payload.recurrence, existing?.recurrence ? normalizeRecurrence(existing.recurrence, 'none') : 'none');
  let cleanRecurrenceEnd = normalizeRecurrenceEnd(payload.recurrenceEnd ?? existing?.recurrenceEnd);
  let cleanRecurrenceCount = normalizeRecurrenceCount(payload.recurrenceCount ?? existing?.recurrenceCount);
  const cleanRecurrenceId =
    normalizeRecurrenceId(payload.id ? existing?.recurrenceId : null) ||
    normalizeRecurrenceId(payload.recurrenceId ?? null);
  if (cleanRecurrence === 'none') {
    cleanRecurrenceEnd = null;
    cleanRecurrenceCount = null;
  }
  const effectiveRecurrenceId = cleanRecurrence === 'none' ? null : cleanRecurrenceId || existing?.id || nextId;
  const storedTitle = cleanRecurrence !== 'none' && cleanDue ? appendDateSuffix(safeTitle, cleanDue) : safeTitle;
  const cleanTags = normalizeTags(payload.tags);
  const cleanOrder = normalizeOrder(payload.order ?? existing?.order);

  const targetBucket = bucketForDue(cleanDue);
  const oldBucket = existing ? existing.bucket : null;

  if (oldBucket && oldBucket !== targetBucket) {
    const oldItems = await readBucket(oldBucket);
    const remaining = oldItems.filter((todo) => todo.id !== nextId);
    await writeBucket(oldBucket, remaining);
  }

  const bucketItems = await readBucket(targetBucket);
  const filtered = bucketItems.filter((todo) => todo.id !== nextId);
  filtered.push({
    id: nextId,
    title: storedTitle,
    body: cleanBody,
    due: cleanDue,
    status: cleanStatus,
    remind: cleanRemind,
    priority: cleanPriority,
    recurrence: cleanRecurrence,
    recurrenceEnd: cleanRecurrenceEnd,
    recurrenceCount: cleanRecurrenceCount,
    recurrenceId: effectiveRecurrenceId,
    tags: cleanTags,
    order: cleanOrder,
    created: existing ? existing.created || now : now,
    updated: now,
    bucket: targetBucket,
  });
  filtered.sort((a, b) => {
    const dueCmp = compareDue(a, b);
    if (dueCmp !== 0) return dueCmp;
    const orderA = normalizeOrder(a.order) ?? Number.POSITIVE_INFINITY;
    const orderB = normalizeOrder(b.order) ?? Number.POSITIVE_INFINITY;
    if (orderA !== orderB) return orderA - orderB;
    const aUpdated = a.updated ? Date.parse(a.updated) : 0;
    const bUpdated = b.updated ? Date.parse(b.updated) : 0;
    return bUpdated - aUpdated;
  });
  await writeBucket(targetBucket, filtered);

  scheduleNext(`Update todo: ${stripDateSuffix(storedTitle) || 'Untitled'}`);

  if (prevStatus !== 'done' && cleanStatus === 'done' && cleanRecurrence !== 'none') {
    const baseDue = cleanDue || existing?.due || formatDateKey(new Date());
    const nextDue = computeNextDue(baseDue, cleanRecurrence as any);
    const hasRemaining = cleanRecurrenceCount === null || cleanRecurrenceCount > 1;
    const withinEnd = !cleanRecurrenceEnd || (nextDue && nextDue <= cleanRecurrenceEnd);
    if (nextDue && hasRemaining && withinEnd) {
      const nextCount = cleanRecurrenceCount === null ? null : Math.max(1, cleanRecurrenceCount - 1);
      const nextTitle = appendDateSuffix(stripDateSuffix(storedTitle), nextDue);
      await saveTodo(
        {
          id: null,
          title: nextTitle,
          body: cleanBody,
          due: nextDue,
          status: 'todo',
          remind: cleanRemind,
          priority: cleanPriority as any,
          recurrence: cleanRecurrence as any,
          recurrenceId: effectiveRecurrenceId,
          recurrenceEnd: cleanRecurrenceEnd,
          recurrenceCount: nextCount,
          tags: cleanTags,
          order: cleanOrder,
        },
        scheduleNext
      );
    }
  }

  return { id: nextId };
}

export async function deleteTodo(id: string, scheduleNext: (message: string) => void) {
  await ensureTodosDir();
  const items = await loadAllTodos();
  const existing = items.find((todo) => todo.id === id);
  if (!existing) return false;
  const bucketItems = await readBucket(existing.bucket);
  const remaining = bucketItems.filter((todo) => todo.id !== id);
  await writeBucket(existing.bucket, remaining);
  scheduleNext(`Delete todo: ${stripDateSuffix(existing.title) || 'Untitled'}`);
  return true;
}

export async function deleteTodoSeries(id: string, scheduleNext: (message: string) => void) {
  await ensureTodosDir();
  const items = await loadAllTodos();
  const existing = items.find((todo) => todo.id === id);
  if (!existing) return false;
  const seriesId = existing.recurrenceId || (existing.recurrence !== 'none' ? existing.id : null);
  if (!seriesId) {
    return deleteTodo(id, scheduleNext);
  }
  const cutoff = existing.due || null;
  const remaining: StoredTodo[] = [];
  for (const todo of items) {
    if (todo.recurrenceId !== seriesId) {
      remaining.push(todo);
      continue;
    }
    if (!cutoff) {
      continue;
    }
    if (!todo.due) {
      continue;
    }
    if (todo.due < cutoff) {
      remaining.push(todo);
    }
  }
  const buckets = new Map<string, StoredTodo[]>();
  for (const todo of remaining) {
    if (!buckets.has(todo.bucket)) buckets.set(todo.bucket, []);
    buckets.get(todo.bucket)!.push(todo);
  }
  const bucketNames = new Set(items.map((todo) => todo.bucket));
  for (const name of bucketNames) {
    const bucketItems = buckets.get(name) || [];
    await writeBucket(name, bucketItems);
  }
  scheduleNext(`Delete series: ${stripDateSuffix(existing.title) || 'Untitled'}`);
  return true;
}

export async function moveTodoToDue(
  id: string,
  due: string | null,
  order: number | null,
  scheduleNext: (message: string) => void
) {
  const todo = await readTodo(id);
  if (!todo) return null;
  return saveTodo(
    {
      id: todo.id,
      title: todo.title,
      body: todo.body,
      due,
      status: todo.status,
      remind: todo.remind,
      priority: todo.priority,
      recurrence: todo.recurrence,
      recurrenceEnd: todo.recurrenceEnd,
      recurrenceCount: todo.recurrenceCount,
      tags: todo.tags,
      order: order ?? todo.order,
    },
    scheduleNext
  );
}

export async function reorderTodos(ids: string[], scheduleNext: (message: string) => void) {
  const items = await loadAllTodos();
  const lookup = new Map(items.map((item) => [item.id, item]));
  const updated: StoredTodo[] = [];
  ids.forEach((id, index) => {
    const todo = lookup.get(id);
    if (!todo) return;
    updated.push({ ...todo, order: index + 1 });
  });
  const buckets = new Map<string, StoredTodo[]>();
  items.forEach((todo) => {
    const replacement = updated.find((item) => item.id === todo.id) || todo;
    if (!buckets.has(replacement.bucket)) buckets.set(replacement.bucket, []);
    buckets.get(replacement.bucket)!.push(replacement);
  });
  for (const [bucket, list] of buckets.entries()) {
    await writeBucket(bucket, list);
  }
  scheduleNext('Reorder todos');
}

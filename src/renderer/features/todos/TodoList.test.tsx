import { render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import TodoList from './TodoList';
import type { TodoListItem } from '../../../shared/models/todo';
import { formatDateKey } from '../../../shared/utils/date';

function buildTodo(overrides: Partial<TodoListItem>): TodoListItem {
  return {
    id: overrides.id || 'todo-1',
    title: overrides.title || 'Todo',
    due: overrides.due ?? null,
    status: overrides.status || 'todo',
    remind: overrides.remind || 'none',
    priority: overrides.priority || 'normal',
    recurrence: overrides.recurrence || 'none',
    recurrenceEnd: overrides.recurrenceEnd ?? null,
    recurrenceCount: overrides.recurrenceCount ?? null,
    tags: overrides.tags || [],
    createdMs: overrides.createdMs ?? 0,
    updatedMs: overrides.updatedMs ?? 0,
    excerpt: overrides.excerpt || '',
    order: overrides.order ?? null,
  };
}

function renderList(todos: TodoListItem[], filterText: string, currentTab: 'todo' | 'done' = 'todo') {
  render(
    <TodoList
      todos={todos}
      activeCache={null}
      draftCache={null}
      selectedId={null}
      currentTab={currentTab}
      sortKey="due"
      filterText={filterText}
      dndEnabled={false}
      pendingDeleteId={null}
      onSelect={vi.fn()}
      onActivateField={vi.fn()}
      onUpdateCache={vi.fn()}
      onToggleDone={vi.fn()}
      onSave={vi.fn()}
      onRequestDelete={vi.fn()}
      onConfirmDelete={vi.fn()}
      onConfirmDeleteSeries={vi.fn()}
      onCancelDelete={vi.fn()}
      onOpenRecurrence={vi.fn()}
      onOpenTags={vi.fn()}
      onBulkDone={vi.fn()}
      onBulkDelete={vi.fn()}
      onSuspendAutoSave={vi.fn()}
      onMoveDue={vi.fn().mockResolvedValue(undefined)}
      onReorder={vi.fn().mockResolvedValue(undefined)}
    />
  );
}

describe('TodoList', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('filters by tags with AND semantics', () => {
    const todayKey = formatDateKey(new Date());
    const todos = [
      buildTodo({ id: 'a', title: 'Write report', tags: ['alice', 'report'], due: todayKey }),
      buildTodo({ id: 'b', title: 'Follow up', tags: ['alice'], due: todayKey }),
    ];

    renderList(todos, '#alice #report');

    expect(screen.getByText('Write report')).toBeInTheDocument();
    expect(screen.queryByText('Follow up')).not.toBeInTheDocument();
  });

  it('honors status filter tokens over the current tab', () => {
    const todayKey = formatDateKey(new Date());
    const todos = [
      buildTodo({ id: 'a', title: 'Pending', status: 'todo', due: todayKey }),
      buildTodo({ id: 'b', title: 'Complete', status: 'done', due: todayKey }),
    ];

    renderList(todos, 'done', 'todo');

    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
  });
});

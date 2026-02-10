import type { RecurrenceRule, TodoListItem, TodoPriority, TodoStatus } from '../../../shared/models/todo';

export type ActiveField = 'title' | 'body' | 'due' | null;

export interface EditCache {
  id: string;
  title: string;
  body: string;
  due: string;
  status: TodoStatus;
  remind: string;
  priority: TodoPriority;
  recurrence: RecurrenceRule;
  recurrenceEnd: string | null;
  recurrenceCount: number | null;
  tags: string[];
  order: number | null;
  dirty: boolean;
  originalDue: string;
  activeField: ActiveField;
}

export type SortKey = 'due' | 'title' | 'created' | 'updated';
export type TabKey = 'todo' | 'done';

export interface SectionConfig {
  key: string;
  label: string;
  targetDue: string | null;
}

export interface UiTodo extends TodoListItem {
  isDraft?: boolean;
}

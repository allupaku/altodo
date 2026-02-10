export type TodoStatus = 'todo' | 'done' | 'deferred';
export type TodoPriority = 'normal' | 'high';
export type RecurrenceRule =
  | 'none'
  | 'daily'
  | 'weekdays'
  | 'biweekly'
  | 'monthly'
  | `weekly:${0 | 1 | 2 | 3 | 4 | 5 | 6}`;

export interface TodoListItem {
  id: string;
  title: string;
  due: string | null;
  status: TodoStatus;
  remind: string;
  priority: TodoPriority;
  recurrence: RecurrenceRule;
  recurrenceEnd: string | null;
  recurrenceCount: number | null;
  tags: string[];
  createdMs: number | null;
  updatedMs: number | null;
  excerpt: string;
  order: number | null;
}

export interface TodoDetail extends TodoListItem {
  body: string;
  created: string | null;
}

export interface TodoSavePayload {
  id: string | null;
  title: string;
  body: string;
  due: string | null;
  status: TodoStatus;
  remind: string;
  priority: TodoPriority;
  recurrence: RecurrenceRule;
  recurrenceEnd: string | null;
  recurrenceCount: number | null;
  tags: string[];
  order: number | null;
}

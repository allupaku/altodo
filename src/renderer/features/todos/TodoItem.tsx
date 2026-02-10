import React, { useEffect, useRef } from 'react';
import type { TodoListItem } from '../../../shared/models/todo';
import type { EditCache } from './types';
import { formatDate, recurrenceLabel, remindLabel, statusLabel } from './todoUtils';
import TagChips from './TagChips';
import { formatDateKey } from '../../../shared/utils/date';

interface TodoItemProps {
  todo: TodoListItem;
  cache: EditCache | null;
  isActive: boolean;
  isDraft: boolean;
  isDragging?: boolean;
  dragHandleProps?: {
    attributes: React.HTMLAttributes<HTMLElement>;
    listeners: Record<string, (event: React.SyntheticEvent) => void>;
  };
  rowIndex: number;
  pendingDelete: boolean;
  onSelect: () => void;
  onActivateField: (field: EditCache['activeField']) => void;
  onUpdateCache: (patch: Partial<EditCache>) => void;
  onToggleDone: (done: boolean) => void;
  onSave: (options?: { exit?: boolean }) => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onConfirmDeleteSeries: () => void;
  onCancelDelete: () => void;
  onOpenRecurrence: () => void;
  onOpenTags: () => void;
  onSuspendAutoSave: (value: boolean) => void;
}

export default function TodoItem({
  todo,
  cache,
  isActive,
  isDraft,
  isDragging = false,
  dragHandleProps,
  rowIndex,
  pendingDelete,
  onSelect,
  onActivateField,
  onUpdateCache,
  onToggleDone,
  onSave,
  onRequestDelete,
  onConfirmDelete,
  onConfirmDeleteSeries,
  onCancelDelete,
  onOpenRecurrence,
  onOpenTags,
  onSuspendAutoSave,
}: TodoItemProps) {
  const titleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const effective = cache || {
    title: todo.title || '',
    body: '',
    due: todo.due || '',
    status: todo.status,
    remind: todo.remind,
    priority: todo.priority,
    recurrence: todo.recurrence,
    recurrenceEnd: todo.recurrenceEnd,
    recurrenceCount: todo.recurrenceCount,
    tags: todo.tags,
    order: todo.order,
  };

  const dueValue = isActive ? effective.due : todo.due || '';
  const statusValue = isActive ? effective.status : todo.status;
  const todayKey = formatDateKey(new Date());
  const isOverdue = Boolean(dueValue && dueValue < todayKey && statusValue !== 'done');
  const isDeferred = statusValue === 'deferred';

  const reminderValue = isActive ? effective.remind : todo.remind;
  const recurrenceValue = isActive ? effective.recurrence : todo.recurrence;
  const recurrenceText = recurrenceLabel(recurrenceValue);
  const tags = effective.tags || todo.tags || [];

  const showOverdue = !isDraft && statusValue !== 'done' && (isOverdue || isDeferred);
  const titleValue = isDraft ? effective.title : effective.title || todo.title || '';
  const bodyValue = isActive ? effective.body : todo.excerpt || '';
  const isEditingTitle = isActive;
  const isEditingBody = isActive;

  useEffect(() => {
    if (!titleRef.current) return;
    if (isEditingTitle) return;
    if (titleRef.current.innerText !== titleValue) {
      titleRef.current.innerText = titleValue;
    }
  }, [titleValue, isEditingTitle]);

  useEffect(() => {
    if (!bodyRef.current) return;
    if (isEditingBody) return;
    if (bodyRef.current.innerText !== bodyValue) {
      bodyRef.current.innerText = bodyValue;
    }
  }, [bodyValue, isEditingBody]);

  return (
    <div
      className={`todo-item ${rowIndex % 2 === 1 ? 'row-alt' : ''} ${isActive ? 'active' : ''} status-${statusValue}`}
      onClick={() => {
        if (isDragging) return;
        onSelect();
      }}
    >
      <div className="todo-left">
        {!isDraft && (
          <label className="done-toggle" onClick={(event) => event.stopPropagation()}>
            <input
              type="checkbox"
              checked={statusValue === 'done'}
              onChange={(event) => onToggleDone(event.target.checked)}
              className={showOverdue ? 'overdue' : ''}
            />
          </label>
        )}
        {dragHandleProps && (
          <button
            className="icon plain drag-handle-btn"
            type="button"
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
            onClick={(event) => event.stopPropagation()}
          >
            ⋮⋮
          </button>
        )}
        {!isDraft && (
          <button className="icon plain recurrence-inline" type="button" onClick={(event) => {
            event.stopPropagation();
            onOpenRecurrence();
          }}>
            ⟳
          </button>
        )}
      </div>
      <div className="todo-header-left">
        <div
          className="todo-title"
          contentEditable={isActive && !isDragging}
          suppressContentEditableWarning
          ref={titleRef}
          data-placeholder="Title"
          dir="ltr"
          style={{ unicodeBidi: 'plaintext' }}
          onClick={(event) => {
            event.stopPropagation();
            if (!isActive) {
              onSelect();
              return;
            }
            onActivateField('title');
          }}
          onFocus={() => {
            if (isActive) onActivateField('title');
          }}
          onInput={(event) => {
            const next = (event.target as HTMLElement).innerText;
            onUpdateCache({ title: next });
          }}
        />
        <div className="todo-meta">
          <div className="todo-meta-row">
            <span className="todo-status" style={{ display: statusValue !== 'todo' ? 'inline-flex' : 'none' }}>
              {isDraft ? 'Draft' : statusLabel(statusValue)}
            </span>
            <span
              className="todo-priority"
              style={{ display: effective.priority === 'high' ? 'inline-flex' : 'none' }}
            >
              High
            </span>
            <span
              className="todo-recurrence"
              style={{ display: recurrenceText ? 'inline-flex' : 'none' }}
            >
              {recurrenceText}
            </span>
            <span className={`todo-due ${isOverdue ? 'overdue' : ''}`}>
              <span className="due-prefix">Due</span>
              <input
                type="date"
                className={`due-date inline ${isOverdue ? 'overdue' : ''}`}
                value={dueValue}
                disabled={!isActive}
                onFocus={() => onSuspendAutoSave(true)}
                onBlur={() => onSuspendAutoSave(false)}
                onChange={(event) => {
                  onUpdateCache({ due: event.target.value });
                }}
              />
            </span>
            <span className={`todo-remind ${reminderValue && reminderValue !== 'none' ? '' : 'hidden'}`}>
              {isActive ? (
                <select
                  className="remind-inline"
                  value={reminderValue}
                  onChange={(event) => onUpdateCache({ remind: event.target.value })}
                >
                  <option value="none">No reminder</option>
                  <option value="5m">5 minutes before</option>
                  <option value="30m">30 minutes before</option>
                  <option value="1h">1 hour before</option>
                  <option value="1d">1 day before</option>
                </select>
              ) : (
                remindLabel(reminderValue)
              )}
            </span>
          </div>
          <div className="todo-tags">
            {!isDraft && (
              <button
                className="icon plain tag-inline"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenTags();
                }}
              >
                🏷
              </button>
            )}
            {tags.length > 0 && <TagChips tags={tags} />}
          </div>
        </div>
      </div>
      <div className="todo-header-actions">
        <button
          className="icon plain danger-text"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRequestDelete();
          }}
        >
          🗑
        </button>
        <button
          className="icon plain action save"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSave({ exit: true });
          }}
          style={{ visibility: isActive ? 'visible' : 'hidden' }}
        >
          💾
        </button>
      </div>
      <div
        className="todo-body"
        contentEditable={isActive && !isDragging}
        suppressContentEditableWarning
        ref={bodyRef}
        data-placeholder="Description"
        dir="ltr"
        style={{ unicodeBidi: 'plaintext' }}
        onClick={(event) => {
          event.stopPropagation();
          if (!isActive) {
            onSelect();
            return;
          }
          onActivateField('body');
        }}
        onFocus={() => {
          if (isActive) onActivateField('body');
        }}
        onInput={(event) => {
          const next = (event.target as HTMLElement).innerText;
          onUpdateCache({ body: next });
        }}
      />
      {todo.updatedMs && !isDraft && (
        <div className="todo-updated">Updated {formatDate(todo.updatedMs)}</div>
      )}
      {pendingDelete && (
        <div className="delete-confirm" onClick={(event) => event.stopPropagation()}>
          <span>{todo.recurrence !== 'none' ? 'Delete recurring todo?' : 'Delete?'}</span>
          {todo.recurrence !== 'none' ? (
            <>
              <button className="ghost danger-text" type="button" onClick={onConfirmDelete}>
                This
              </button>
              <button className="ghost danger-text" type="button" onClick={onConfirmDeleteSeries}>
                All upcoming
              </button>
            </>
          ) : (
            <button className="icon plain danger-text" type="button" onClick={onConfirmDelete}>
              🗑
            </button>
          )}
          <button className="icon plain" type="button" onClick={onCancelDelete}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

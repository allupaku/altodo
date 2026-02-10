import React from 'react';
import type { TodoListItem } from '../../../shared/models/todo';
import type { EditCache, SortKey, TabKey } from './types';
import {
  buildSearchText,
  buildSections,
  getSectionKey,
  isDoneInDoneTab,
  matchesStatusFilter,
  matchesTagFilter,
  matchesTextFilter,
  parseFilterTokens,
  sortItems,
} from './todoUtils';
import TodoItem from './TodoItem';
import SectionHeader from './SectionHeader';

interface TodoListProps {
  todos: TodoListItem[];
  activeCache: EditCache | null;
  draftCache: EditCache | null;
  selectedId: string | null;
  currentTab: TabKey;
  sortKey: SortKey;
  filterText: string;
  pendingDeleteId: string | null;
  onSelect: (todo: TodoListItem) => void;
  onActivateField: (field: EditCache['activeField']) => void;
  onUpdateCache: (patch: Partial<EditCache>) => void;
  onToggleDone: (todo: TodoListItem, done: boolean) => void;
  onSave: () => void;
  onRequestDelete: (todo: TodoListItem) => void;
  onConfirmDelete: (todo: TodoListItem) => void;
  onConfirmDeleteSeries: (todo: TodoListItem) => void;
  onCancelDelete: () => void;
  onOpenRecurrence: (todo: TodoListItem) => void;
  onOpenTags: (todo: TodoListItem) => void;
  onBulkDone: (items: TodoListItem[], label: string) => void;
  onBulkDelete: (items: TodoListItem[], label: string) => void;
  onSuspendAutoSave: (value: boolean) => void;
}

export default function TodoList({
  todos,
  activeCache,
  draftCache,
  selectedId,
  currentTab,
  sortKey,
  filterText,
  pendingDeleteId,
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
  onBulkDone,
  onBulkDelete,
  onSuspendAutoSave,
}: TodoListProps) {
  const today = new Date();
  let items = todos.filter((todo) => !todo.isDraft);
  const filters = parseFilterTokens(filterText);
  if (filters.statusTokens.length) {
    items = items.filter((todo) => matchesStatusFilter(todo.status, filters.statusTokens));
  } else if (currentTab === 'done') {
    items = items.filter((todo) => isDoneInDoneTab(todo, today));
  } else {
    items = items.filter((todo) => !isDoneInDoneTab(todo, today));
  }
  if (filters.tagTokens.length) {
    items = items.filter((todo) => matchesTagFilter(todo.tags || [], filters.tagTokens));
  }
  if (filters.textTokens.length) {
    items = items.filter((todo) => matchesTextFilter(buildSearchText(todo), filters.textTokens));
  }

  const overallEmpty = items.length === 0 && !draftCache;
  if (overallEmpty) {
    return (
      <div className="todo-item">
        {filterText
          ? `No todos match "${filterText}".`
          : currentTab === 'done'
            ? 'No done todos yet.'
            : 'No todos yet. Click + or press Ctrl+N.'}
      </div>
    );
  }

  if (currentTab === 'todo') {
    const { sections, todayKey, tomorrowKey, endOfWeekKey, nextWeekKey, isFriday } = buildSections(today);
    const bucketed: Record<string, TodoListItem[]> = {};
    sections.forEach((section) => {
      bucketed[section.key] = [];
    });
    items.forEach((todo) => {
      const key = getSectionKey(todo, todayKey, tomorrowKey, endOfWeekKey, nextWeekKey, isFriday);
      bucketed[key].push(todo);
    });
    let rowIndex = 0;
    return (
      <>
        {sections.map((section) => {
          const sectionItems = sortItems(bucketed[section.key] || [], sortKey, currentTab);
          if (!sectionItems.length) return null;
          return (
            <React.Fragment key={section.key}>
              <SectionHeader
                label={section.label}
                items={sectionItems}
                onBulkDone={() => onBulkDone(sectionItems, section.label)}
                onBulkDelete={() => onBulkDelete(sectionItems, section.label)}
              />
              {sectionItems.map((todo) => {
                const isActive = selectedId === todo.id;
                return (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    cache={isActive ? activeCache : null}
                    isActive={isActive}
                    isDraft={false}
                    rowIndex={rowIndex++}
                    pendingDelete={pendingDeleteId === todo.id}
                    onSelect={() => onSelect(todo)}
                    onActivateField={onActivateField}
                    onUpdateCache={onUpdateCache}
                    onToggleDone={(done) => onToggleDone(todo, done)}
                    onSave={onSave}
                    onRequestDelete={() => onRequestDelete(todo)}
                    onConfirmDelete={() => onConfirmDelete(todo)}
                    onConfirmDeleteSeries={() => onConfirmDeleteSeries(todo)}
                    onCancelDelete={onCancelDelete}
                    onOpenRecurrence={() => onOpenRecurrence(todo)}
                    onOpenTags={() => onOpenTags(todo)}
                    onSuspendAutoSave={onSuspendAutoSave}
                  />
                );
              })}
            </React.Fragment>
          );
        })}
      </>
    );
  }

  const sortedItems = sortItems(items, sortKey, currentTab);
  let rowIndex = 0;
  return (
    <>
      {sortedItems.map((todo) => {
        const isActive = selectedId === todo.id;
        return (
          <TodoItem
            key={todo.id}
            todo={todo}
            cache={isActive ? activeCache : null}
            isActive={isActive}
            isDraft={false}
            rowIndex={rowIndex++}
            pendingDelete={pendingDeleteId === todo.id}
            onSelect={() => onSelect(todo)}
            onActivateField={onActivateField}
            onUpdateCache={onUpdateCache}
            onToggleDone={(done) => onToggleDone(todo, done)}
            onSave={onSave}
            onRequestDelete={() => onRequestDelete(todo)}
            onConfirmDelete={() => onConfirmDelete(todo)}
            onConfirmDeleteSeries={() => onConfirmDeleteSeries(todo)}
            onCancelDelete={onCancelDelete}
            onOpenRecurrence={() => onOpenRecurrence(todo)}
            onOpenTags={() => onOpenTags(todo)}
            onSuspendAutoSave={onSuspendAutoSave}
          />
        );
      })}
    </>
  );
}

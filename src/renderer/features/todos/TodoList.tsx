import React from 'react';
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

function SectionDroppable({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} data-section={id}>
      {children}
    </div>
  );
}

type DragHandleProps = {
  attributes: React.HTMLAttributes<HTMLElement>;
  listeners: Record<string, (event: React.SyntheticEvent) => void>;
};

function SortableWrapper({
  id,
  children,
}: {
  id: string;
  children: (handleProps: DragHandleProps, isDragging: boolean) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const safeListeners = React.useMemo(() => {
    const result: Record<string, (event: React.SyntheticEvent) => void> = {};
    if (!listeners) return result;
    Object.entries(listeners).forEach(([key, handler]) => {
      result[key] = (event: React.SyntheticEvent) => {
        event.stopPropagation();
        (handler as (evt: React.SyntheticEvent) => void)(event);
      };
    });
    return result;
  }, [listeners]);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  } as React.CSSProperties;
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners: safeListeners }, isDragging)}
    </div>
  );
}

interface TodoListProps {
  todos: TodoListItem[];
  activeCache: EditCache | null;
  draftCache: EditCache | null;
  selectedId: string | null;
  currentTab: TabKey;
  sortKey: SortKey;
  filterText: string;
  tagFilters: string[];
  dndEnabled: boolean;
  pendingDeleteId: string | null;
  onSelect: (todo: TodoListItem) => void;
  onActivateField: (field: EditCache['activeField']) => void;
  onUpdateCache: (patch: Partial<EditCache>) => void;
  onToggleDone: (todo: TodoListItem, done: boolean) => void;
  onSave: (options?: { exit?: boolean }) => void;
  onRequestDelete: (todo: TodoListItem) => void;
  onConfirmDelete: (todo: TodoListItem) => void;
  onConfirmDeleteSeries: (todo: TodoListItem) => void;
  onCancelDelete: () => void;
  onOpenRecurrence: (todo: TodoListItem) => void;
  onOpenTags: (todo: TodoListItem) => void;
  onBulkDone: (items: TodoListItem[], label: string) => void;
  onBulkDelete: (items: TodoListItem[], label: string) => void;
  onBulkMove: (items: TodoListItem[], label: string) => void;
  onSuspendAutoSave: (value: boolean) => void;
  onMoveDue: (id: string, due: string | null, order?: number | null) => Promise<void>;
  onReorder: (ids: string[]) => Promise<void>;
}

export default function TodoList({
  todos,
  activeCache,
  draftCache,
  selectedId,
  currentTab,
  sortKey,
  filterText,
  tagFilters,
  dndEnabled,
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
  onBulkMove,
  onSuspendAutoSave,
  onMoveDue,
  onReorder,
}: TodoListProps) {
  let items = todos.filter((todo) => !todo.isDraft);
  const filters = parseFilterTokens(filterText);
  const combinedTagTokens = Array.from(
    new Set([...filters.tagTokens, ...tagFilters].map((token) => token.toLowerCase()))
  );
  if (filters.statusTokens.length) {
    items = items.filter((todo) => matchesStatusFilter(todo.status, filters.statusTokens));
  } else if (currentTab === 'done') {
    items = items.filter((todo) => isDoneInDoneTab(todo));
  } else {
    items = items.filter((todo) => !isDoneInDoneTab(todo));
  }
  if (combinedTagTokens.length) {
    items = items.filter((todo) => matchesTagFilter(todo.tags || [], combinedTagTokens));
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
    const today = new Date();
    const { sections, todayKey, tomorrowKey, endOfWeekKey, nextWeekKey, isFriday } = buildSections(today);
    const bucketed: Record<string, TodoListItem[]> = {};
    sections.forEach((section) => {
      bucketed[section.key] = [];
    });
    items.forEach((todo) => {
      const key = getSectionKey(todo, todayKey, tomorrowKey, endOfWeekKey, nextWeekKey, isFriday);
      bucketed[key].push(todo);
    });
    const sectionItemsMap = sections.map((section) => ({
      section,
      items: sortItems(bucketed[section.key] || [], sortKey, currentTab),
    }));
    const idToSection = new Map<string, string>();
    sectionItemsMap.forEach(({ section, items: sectionItems }) => {
      sectionItems.forEach((todo) => idToSection.set(todo.id, section.key));
    });

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    async function handleDragEnd(event: DragEndEvent) {
      if (!event.over) return;
      const activeId = String(event.active.id);
      const overId = String(event.over.id);
      if (activeId === overId) return;
      const sourceSection = idToSection.get(activeId);
      if (!sourceSection) return;
      const targetSection = overId.startsWith('section:')
        ? overId.replace('section:', '')
        : idToSection.get(overId);
      if (!targetSection) return;
      const sourceIds = sectionItemsMap.find((entry) => entry.section.key === sourceSection)?.items.map((todo) => todo.id) || [];
      const targetIds = sectionItemsMap.find((entry) => entry.section.key === targetSection)?.items.map((todo) => todo.id) || [];
      if (sourceSection === targetSection) {
        const oldIndex = sourceIds.indexOf(activeId);
        const newIndex = overId.startsWith('section:') ? sourceIds.length - 1 : sourceIds.indexOf(overId);
        if (oldIndex < 0 || newIndex < 0) return;
        const nextIds = arrayMove(sourceIds, oldIndex, newIndex);
        await onReorder(nextIds);
        return;
      }
      const targetIndex = overId.startsWith('section:') ? targetIds.length : targetIds.indexOf(overId);
      if (targetIndex < 0) return;
      const nextTargetIds = [...targetIds];
      nextTargetIds.splice(targetIndex, 0, activeId);
      const nextSourceIds = sourceIds.filter((id) => id !== activeId);
      const targetConfig = sections.find((section) => section.key === targetSection);
      const targetDue = targetConfig ? targetConfig.targetDue : null;
      await onMoveDue(activeId, targetDue, targetIndex + 1);
      if (nextSourceIds.length) {
        await onReorder(nextSourceIds);
      }
      await onReorder(nextTargetIds);
    }

    const renderSectionItems = (sectionItems: TodoListItem[], rowIndexRef: { value: number }) =>
      sectionItems.map((todo) => {
        const isActive = selectedId === todo.id;
        return (
          <TodoItem
            key={todo.id}
            todo={todo}
            cache={isActive ? activeCache : null}
            isActive={isActive}
            isDraft={false}
            rowIndex={rowIndexRef.value++}
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
      });

    if (!dndEnabled) {
      const rowIndexRef = { value: 0 };
      return (
        <>
          {sectionItemsMap.map(({ section, items: sectionItems }) => {
            if (!sectionItems.length) return null;
            return (
              <React.Fragment key={section.key}>
                <SectionHeader
                  label={section.label}
                  items={sectionItems}
                  onBulkDone={() => onBulkDone(sectionItems, section.label)}
                  onBulkDelete={() => onBulkDelete(sectionItems, section.label)}
                  onBulkMove={() => onBulkMove(sectionItems, section.label)}
                />
                {renderSectionItems(sectionItems, rowIndexRef)}
              </React.Fragment>
            );
          })}
        </>
      );
    }

    const rowIndexRef = { value: 0 };
    return (
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {sectionItemsMap.map(({ section, items: sectionItems }) => (
          <React.Fragment key={section.key}>
            <SectionHeader
              label={section.label}
              items={sectionItems}
              onBulkDone={() => onBulkDone(sectionItems, section.label)}
              onBulkDelete={() => onBulkDelete(sectionItems, section.label)}
              onBulkMove={() => onBulkMove(sectionItems, section.label)}
              showWhenEmpty
            />
            <SectionDroppable id={`section:${section.key}`}>
              <SortableContext items={sectionItems.map((todo) => todo.id)} strategy={verticalListSortingStrategy}>
                {sectionItems.length === 0 && <div className="section-empty">Drop here</div>}
                {sectionItems.map((todo) => {
                  const isActive = selectedId === todo.id;
                  return (
                    <SortableWrapper key={todo.id} id={todo.id}>
                      {(handleProps, isDragging) => (
                        <TodoItem
                          todo={todo}
                          cache={isActive ? activeCache : null}
                          isActive={isActive}
                          isDraft={false}
                          isDragging={isDragging}
                          dragHandleProps={handleProps}
                          rowIndex={rowIndexRef.value++}
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
                      )}
                    </SortableWrapper>
                  );
                })}
              </SortableContext>
            </SectionDroppable>
          </React.Fragment>
        ))}
      </DndContext>
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

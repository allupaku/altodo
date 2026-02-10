import React, { useMemo, useState } from 'react';
import { useTodoController } from './useTodoController';
import TodoList from './TodoList';
import DraftModal from './DraftModal';
import RecurrenceModal from './RecurrenceModal';
import TagModal from './TagModal';
import SettingsPanel from '../settings/SettingsPanel';
import { isDoneInDoneTab } from './todoUtils';

const STATUS_SUGGESTIONS = ['todo', 'done', 'deferred'];

export default function TodoShell() {
  const {
    todos,
    selectedId,
    activeCache,
    draftCache,
    currentTab,
    sortKey,
    filterText,
    settings,
    displays,
    gitStatus,
    pendingDeleteId,
    draftOpen,
    recurrenceDraft,
    tagDraft,
    allTags,
    actions,
  } = useTodoController();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const filterSuggestions = useMemo(() => {
    const tags = allTags;
    return Array.from(new Set([...tags, ...STATUS_SUGGESTIONS]));
  }, [allTags]);

  const today = new Date();
  const doneCount = todos.filter((todo) => isDoneInDoneTab(todo, today)).length;
  const todoCount =
    todos.filter((todo) => !isDoneInDoneTab(todo, today)).length + (draftCache ? 1 : 0);

  const gitStatusLine = gitStatus?.available
    ? gitStatus.message
      ? `Last commit: ${gitStatus.message}`
      : 'Git sync enabled'
    : '';
  const isEmpty = todos.length === 0 && !draftCache;

  return (
    <div id="app" className={isEmpty ? 'empty' : ''}>
      <header id="controls">
        <div className="controls-row">
          <div className="drag-handle">
            <div className="title">Todo Bar</div>
            <div className="subtitle">Markdown-backed, always-ready.</div>
          </div>
          <div className="buttons">
            <button id="settingsToggle" className="ghost" type="button" onClick={() => setSettingsOpen(true)}>
              Settings
            </button>
          </div>
        </div>
      </header>
      <main id="content">
        <div id="listToolbar">
          <div className="filter">
            <label htmlFor="filterInput">Filter</label>
            <input
              id="filterInput"
              type="text"
              list="filterSuggestions"
              placeholder="tag, #tag, done, text"
              value={filterText}
              onChange={(event) => actions.setFilterText(event.target.value)}
            />
          </div>
          <div className="sort">
            <label htmlFor="sortSelect">Sort</label>
            <select
              id="sortSelect"
              value={sortKey}
              onChange={(event) => actions.setSortKey(event.target.value as any)}
            >
              <option value="due">Due date</option>
              <option value="created">Created date</option>
              <option value="title">Title</option>
              <option value="updated">Updated date</option>
            </select>
          </div>
        </div>
        <section id="list">
          <TodoList
            todos={todos}
            activeCache={activeCache}
            draftCache={draftCache}
            selectedId={selectedId}
            currentTab={currentTab}
            sortKey={sortKey}
            filterText={filterText}
            pendingDeleteId={pendingDeleteId}
            onSelect={actions.selectTodo}
            onActivateField={actions.activateField}
            onUpdateCache={actions.updateActiveCache}
            onToggleDone={actions.toggleDone}
            onSave={() => actions.saveActive()}
            onRequestDelete={(todo) => actions.setPendingDeleteId(todo.id)}
            onConfirmDelete={actions.deleteTodo}
            onConfirmDeleteSeries={actions.deleteTodoSeries}
            onCancelDelete={() => actions.setPendingDeleteId(null)}
            onOpenRecurrence={actions.openRecurrenceModal}
            onOpenTags={actions.openTagModal}
            onBulkDone={actions.bulkMarkDone}
            onBulkDelete={actions.bulkDelete}
            onSuspendAutoSave={actions.setSuspendAutoSave}
          />
        </section>
      </main>
      <div className="tabs bottom">
        <button
          className={`tab ${currentTab === 'todo' ? 'active' : ''}`}
          type="button"
          onClick={() => actions.setCurrentTab('todo')}
        >
          Todo ({todoCount})
        </button>
        <button
          className={`tab ${currentTab === 'done' ? 'active' : ''}`}
          type="button"
          onClick={() => actions.setCurrentTab('done')}
        >
          Done ({doneCount})
        </button>
      </div>
      <button id="add" className="fab" title="New todo" type="button" onClick={actions.triggerNewTodo}>
        +
      </button>
      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        displays={displays}
        onClose={() => setSettingsOpen(false)}
        onUpdate={actions.setSettings}
      />
      <DraftModal
        open={draftOpen}
        cache={draftCache}
        tags={allTags}
        onClose={actions.discardDraft}
        onSave={actions.saveDraft}
        onChange={actions.updateDraftCache}
        onUpdateTags={(nextTags) => actions.updateDraftCache({ tags: nextTags })}
      />
      <RecurrenceModal
        open={Boolean(recurrenceDraft)}
        recurrence={recurrenceDraft?.recurrence || 'none'}
        endDate={recurrenceDraft?.endDate || ''}
        endCount={recurrenceDraft?.endCount || ''}
        baseDue={recurrenceDraft?.baseDue || ''}
        onChange={(patch) => actions.updateRecurrenceDraft(patch)}
        onClose={actions.closeRecurrenceModal}
        onSave={actions.saveRecurrenceDraft}
      />
      <TagModal
        open={Boolean(tagDraft)}
        tags={tagDraft?.tags || []}
        suggestions={allTags}
        onClose={actions.closeTagModal}
        onChange={(nextTags) => actions.updateTagDraft(nextTags)}
        onConfirm={actions.saveTagDraft}
      />
      <datalist id="filterSuggestions">
        {filterSuggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      {gitStatusLine && <footer className="git-status">{gitStatusLine}</footer>}
    </div>
  );
}

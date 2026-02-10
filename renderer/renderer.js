const api = window.todoApi;

const appEl = document.getElementById('app');
const listEl = document.getElementById('list');
const tabTodo = document.getElementById('tabTodo');
const tabDone = document.getElementById('tabDone');
const sortSelect = document.getElementById('sortSelect');
const tagFilterSelect = document.getElementById('tagFilter');
const addBtn = document.getElementById('add');
const draftOverlay = document.getElementById('draftOverlay');
const draftCard = document.getElementById('draftCard');
const draftTitle = document.getElementById('draftTitle');
const draftBody = document.getElementById('draftBody');
const draftDue = document.getElementById('draftDue');
const draftRemind = document.getElementById('draftRemind');
const draftRepeat = document.getElementById('draftRepeat');
const draftRepeatEndDateRow = document.getElementById('draftRepeatEndDateRow');
const draftRepeatEndCountRow = document.getElementById('draftRepeatEndCountRow');
const draftRepeatEndDate = document.getElementById('draftRepeatEndDate');
const draftRepeatEndCount = document.getElementById('draftRepeatEndCount');
const draftRepeatPreview = document.getElementById('draftRepeatPreview');
const draftTagInput = document.getElementById('draftTagInput');
const draftTagAdd = document.getElementById('draftTagAdd');
const draftTagsList = document.getElementById('draftTags');
const draftSave = document.getElementById('draftSave');
const draftClose = document.getElementById('draftClose');
const recurrenceOverlay = document.getElementById('recurrenceOverlay');
const recurrenceCard = document.getElementById('recurrenceCard');
const recurrenceRepeat = document.getElementById('recurrenceRepeat');
const recurrenceEndDateRow = document.getElementById('recurrenceEndDateRow');
const recurrenceEndCountRow = document.getElementById('recurrenceEndCountRow');
const recurrenceEndDate = document.getElementById('recurrenceEndDate');
const recurrenceEndCount = document.getElementById('recurrenceEndCount');
const recurrenceRepeatPreview = document.getElementById('recurrenceRepeatPreview');
const recurrenceSave = document.getElementById('recurrenceSave');
const recurrenceClose = document.getElementById('recurrenceClose');
const tagOverlay = document.getElementById('tagOverlay');
const tagCard = document.getElementById('tagCard');
const tagEditInput = document.getElementById('tagEditInput');
const tagEditAdd = document.getElementById('tagEditAdd');
const tagEditList = document.getElementById('tagEditList');
const tagSave = document.getElementById('tagSave');
const tagClose = document.getElementById('tagClose');
const tagSuggestions = document.getElementById('tagSuggestions');
const settingsToggle = document.getElementById('settingsToggle');
const settingsClose = document.getElementById('settingsClose');
const settingsPanel = document.getElementById('settingsPanel');
const alwaysOnTopInput = document.getElementById('alwaysOnTop');
const dockRightInput = document.getElementById('dockRight');
const gitEnabledInput = document.getElementById('gitEnabled');
const displaySelect = document.getElementById('displaySelect');
const displayRow = document.getElementById('displayRow');
const widthValueInput = document.getElementById('widthValue');
const widthModeSelect = document.getElementById('widthMode');
const todosDirInput = document.getElementById('todosDir');
const reminderTimeInput = document.getElementById('reminderTime');
const gitStatusEl = document.getElementById('gitStatus');

let todos = [];
let selectedId = null;
let settings = null;
let draft = null;
const editCache = new Map();
let currentTab = 'todo';
let sortKey = 'due';
let isSaving = false;
let suspendAutoSave = false;
let draftModalOpen = false;
let recurrenceModalOpen = false;
let recurrenceEditingId = null;
let tagEditingId = null;
let tagEditingTags = [];
let tagModalOpen = false;
let pendingExternalReload = false;
let pendingDeleteId = null;
let pendingFocus = null;
let currentTagFilter = 'all';

function formatDate(ms) {
  if (!ms) return '';
  const date = new Date(ms);
  return date.toLocaleString();
}

function statusLabel(status) {
  if (status === 'done') return 'Done';
  if (status === 'deferred') return 'Deferred';
  return 'Todo';
}

function remindLabel(value) {
  if (value === '5m') return 'Remind 5 minutes before';
  if (value === '30m') return 'Remind 30 minutes before';
  if (value === '1h') return 'Remind 1 hour before';
  if (value === '1d') return 'Remind 1 day before';
  return '';
}

function recurrenceLabel(value) {
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

function parseRecurrenceCount(value) {
  if (value === null || value === undefined || value === '') return null;
  const count = Number(value);
  if (!Number.isFinite(count)) return null;
  const normalized = Math.floor(count);
  return normalized >= 1 ? normalized : null;
}

function parseDateKey(value) {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function computeNextDueFrom(dateKey, recurrence) {
  if (!recurrence || recurrence === 'none') return null;
  const base = parseDateKey(dateKey) || new Date();
  let next = new Date(base);
  if (recurrence === 'daily') {
    next = addDays(base, 1);
  } else if (recurrence === 'weekdays') {
    next = addDays(base, 1);
    while (next.getDay() === 0 || next.getDay() === 6) {
      next = addDays(next, 1);
    }
  } else if (recurrence === 'biweekly') {
    next = addDays(base, 14);
  } else if (recurrence === 'monthly') {
    const day = base.getDate();
    const month = base.getMonth();
    const year = base.getFullYear();
    const targetMonth = month + 1;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = targetMonth % 12;
    const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
    next = new Date(targetYear, normalizedMonth, Math.min(day, lastDay));
  } else if (recurrence.startsWith('weekly:')) {
    const targetDay = Number(recurrence.split(':')[1]);
    const currentDay = base.getDay();
    let delta = (targetDay - currentDay + 7) % 7;
    if (delta === 0) delta = 7;
    next = addDays(base, delta);
  }
  return formatDateKey(next);
}

function computeEndDateFromCount(baseDue, recurrence, count) {
  const normalized = parseRecurrenceCount(count);
  if (!normalized || normalized <= 1) return baseDue || null;
  let current = baseDue || formatDateKey(new Date());
  for (let i = 1; i < normalized; i += 1) {
    const next = computeNextDueFrom(current, recurrence);
    if (!next) return current;
    current = next;
  }
  return current;
}

function computeCountFromEndDate(baseDue, recurrence, endDate) {
  if (!baseDue || !endDate || !recurrence || recurrence === 'none') return null;
  let count = 1;
  let current = baseDue;
  while (current && current < endDate) {
    const next = computeNextDueFrom(current, recurrence);
    if (!next || next <= current) break;
    current = next;
    count += 1;
    if (count > 500) break;
  }
  return current === endDate ? count : null;
}

function resolveRecurrenceValues(repeatValue, endDateValue, endCountValue, baseDue) {
  if (!repeatValue || repeatValue === 'none') {
    return { recurrence: 'none', recurrenceEnd: null, recurrenceCount: null };
  }
  let count = parseRecurrenceCount(endCountValue);
  let endDate = endDateValue || null;
  if (!endDate && count) {
    endDate = computeEndDateFromCount(baseDue, repeatValue, count);
  }
  if (!count && endDate) {
    count = computeCountFromEndDate(baseDue, repeatValue, endDate);
  }
  return {
    recurrence: repeatValue,
    recurrenceEnd: endDate,
    recurrenceCount: count,
  };
}

function updateRepeatVisibility(repeatValue, dateRow, countRow, previewEl) {
  const hasRepeat = repeatValue && repeatValue !== 'none';
  dateRow.classList.toggle('hidden', !hasRepeat);
  countRow.classList.toggle('hidden', !hasRepeat);
  previewEl.classList.toggle('hidden', !hasRepeat);
}

function updateRepeatPreview(previewEl, baseDue, repeatValue, endDateValue, endCountValue) {
  if (!repeatValue || repeatValue === 'none') {
    previewEl.textContent = '';
    return;
  }
  const dates = [];
  let current = baseDue || formatDateKey(new Date());
  const max = 4;
  dates.push(current);
  for (let i = 1; i < max; i += 1) {
    const next = computeNextDueFrom(current, repeatValue);
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
  previewEl.textContent = `Preview: ${dates.join(' -> ')} - ${limitLabel}`;
}

function buildExcerpt(body) {
  const clean = (body || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length > 110 ? `${clean.slice(0, 110)}…` : clean;
}

function normalizeTag(value) {
  if (!value || typeof value !== 'string') return '';
  return value.trim();
}

function uniqueTags(tags) {
  const seen = new Set();
  const result = [];
  tags.forEach((tag) => {
    const clean = normalizeTag(tag);
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  });
  return result;
}

function collectAllTags() {
  const all = [];
  todos.forEach((todo) => {
    if (Array.isArray(todo.tags)) {
      all.push(...todo.tags);
    }
  });
  return uniqueTags(all);
}

function updateTagSuggestions() {
  if (!tagSuggestions) return;
  const tags = collectAllTags();
  tagSuggestions.innerHTML = '';
  tags.forEach((tag) => {
    const option = document.createElement('option');
    option.value = tag;
    tagSuggestions.appendChild(option);
  });
}

function updateTagFilterOptions() {
  if (!tagFilterSelect) return;
  const tags = collectAllTags();
  tagFilterSelect.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All tags';
  tagFilterSelect.appendChild(allOption);
  tags.forEach((tag) => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag;
    tagFilterSelect.appendChild(option);
  });
  if (tags.includes(currentTagFilter)) {
    tagFilterSelect.value = currentTagFilter;
  } else {
    currentTagFilter = 'all';
    tagFilterSelect.value = 'all';
  }
}

function renderTagChips(container, tags, onRemove) {
  if (!container) return;
  container.innerHTML = '';
  const canRemove = typeof onRemove === 'function';
  uniqueTags(tags).forEach((tag) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.textContent = tag;
    if (canRemove) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.title = 'Remove tag';
      removeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        onRemove(tag);
      });
      chip.appendChild(removeBtn);
    }
    container.appendChild(chip);
  });
}

function getTagsForTodo(todo) {
  if (!todo) return [];
  if (todo.isDraft) {
    const cache = editCache.get('draft');
    if (cache && Array.isArray(cache.tags)) return cache.tags;
  }
  const cache = editCache.get(todo.id);
  if (cache && Array.isArray(cache.tags)) return cache.tags;
  return Array.isArray(todo.tags) ? todo.tags : [];
}

function todoMatchesTag(todo, tag) {
  if (!tag || tag === 'all') return true;
  const tags = getTagsForTodo(todo);
  const target = tag.toLowerCase();
  return tags.some((value) => value.toLowerCase() === target);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodoTitle(todo) {
  if (todo.isDraft) return '';
  return todo.title || todo.id;
}

function isDraftEmpty(cache) {
  if (!cache) return true;
  return !cache.title.trim() && !cache.body.trim();
}

function syncActiveCacheFromDom(cache) {
  const activeItem = listEl.querySelector('.todo-item.active');
  if (!activeItem) return;
  const titleEl = activeItem.querySelector('.todo-title');
  const bodyEl = activeItem.querySelector('.todo-body');
  if (titleEl) {
    const nextTitle = titleEl.innerText.trimStart();
    if (nextTitle !== cache.title) {
      cache.title = nextTitle;
      cache.dirty = true;
    }
  }
  if (bodyEl) {
    const nextBody = bodyEl.innerText;
    if (nextBody !== cache.body) {
      cache.body = nextBody;
      cache.dirty = true;
    }
  }
}

function showDraftModal() {
  if (!draft) return;
  const cache = editCache.get('draft');
  if (!cache) return;
  draftModalOpen = true;
  draftOverlay.classList.remove('hidden');
  draftTitle.textContent = cache.title || '';
  draftBody.textContent = cache.body || '';
  draftDue.value = cache.due || formatDateKey(new Date());
  draftRemind.value = cache.remind || 'none';
  draftRepeat.value = cache.recurrence || 'none';
  const baseDue = cache.due || formatDateKey(new Date());
  const computedEnd =
    cache.recurrenceEnd ||
    (typeof cache.recurrenceCount === 'number'
      ? computeEndDateFromCount(baseDue, cache.recurrence, cache.recurrenceCount)
      : null);
  const computedCount =
    typeof cache.recurrenceCount === 'number'
      ? cache.recurrenceCount
      : cache.recurrenceEnd
        ? computeCountFromEndDate(baseDue, cache.recurrence, cache.recurrenceEnd)
        : null;
  draftRepeatEndDate.value = computedEnd || '';
  draftRepeatEndCount.value = computedCount ? String(computedCount) : '';
  updateRepeatVisibility(draftRepeat.value, draftRepeatEndDateRow, draftRepeatEndCountRow, draftRepeatPreview);
  updateRepeatPreview(
    draftRepeatPreview,
    baseDue,
    draftRepeat.value,
    draftRepeatEndDate.value,
    draftRepeatEndCount.value
  );
  draftTagInput.value = '';
  updateDraftTags();
  setTimeout(() => {
    draftTitle.focus();
    const range = document.createRange();
    range.selectNodeContents(draftTitle);
    range.collapse(false);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, 0);
}

function hideDraftModal() {
  draftModalOpen = false;
  draftOverlay.classList.add('hidden');
}

function showRecurrenceModal(id, todo) {
  recurrenceModalOpen = true;
  recurrenceEditingId = id;
  const cache = editCache.get(id);
  const current = cache || todo || {};
  recurrenceRepeat.value = current.recurrence || 'none';
  const baseDue = current.due || formatDateKey(new Date());
  const computedEnd =
    current.recurrenceEnd ||
    (typeof current.recurrenceCount === 'number'
      ? computeEndDateFromCount(baseDue, current.recurrence, current.recurrenceCount)
      : null);
  const computedCount =
    typeof current.recurrenceCount === 'number'
      ? current.recurrenceCount
      : current.recurrenceEnd
        ? computeCountFromEndDate(baseDue, current.recurrence, current.recurrenceEnd)
        : null;
  recurrenceEndDate.value = computedEnd || '';
  recurrenceEndCount.value = computedCount ? String(computedCount) : '';
  updateRepeatVisibility(
    recurrenceRepeat.value,
    recurrenceEndDateRow,
    recurrenceEndCountRow,
    recurrenceRepeatPreview
  );
  updateRepeatPreview(
    recurrenceRepeatPreview,
    baseDue,
    recurrenceRepeat.value,
    recurrenceEndDate.value,
    recurrenceEndCount.value
  );
  recurrenceOverlay.classList.remove('hidden');
}

function hideRecurrenceModal() {
  recurrenceModalOpen = false;
  recurrenceEditingId = null;
  recurrenceOverlay.classList.add('hidden');
}

function showTagModal(id, todo) {
  tagEditingId = id;
  const cache = editCache.get(id);
  const currentTags = cache && Array.isArray(cache.tags) ? cache.tags : todo.tags || [];
  tagEditingTags = uniqueTags(currentTags);
  updateEditingTags();
  tagEditInput.value = '';
  updateTagSuggestions();
  tagOverlay.classList.remove('hidden');
  tagModalOpen = true;
}

function hideTagModal() {
  tagEditingId = null;
  tagEditingTags = [];
  tagOverlay.classList.add('hidden');
  tagModalOpen = false;
}

function updateDraftTags() {
  const cache = editCache.get('draft');
  if (!cache) return;
  if (!Array.isArray(cache.tags)) {
    cache.tags = [];
  }
  renderTagChips(draftTagsList, cache.tags, (tag) => {
    cache.tags = cache.tags.filter((item) => item !== tag);
    cache.dirty = true;
    updateDraftTags();
  });
}

function addDraftTag() {
  const cache = editCache.get('draft');
  if (!cache) return;
  const nextTag = normalizeTag(draftTagInput.value);
  if (!nextTag) return;
  const combined = uniqueTags([...(cache.tags || []), nextTag]);
  cache.tags = combined;
  cache.dirty = true;
  draftTagInput.value = '';
  updateDraftTags();
}

function updateEditingTags() {
  renderTagChips(tagEditList, tagEditingTags, (tag) => {
    tagEditingTags = tagEditingTags.filter((item) => item !== tag);
    updateEditingTags();
  });
}

function addEditingTag() {
  const nextTag = normalizeTag(tagEditInput.value);
  if (!nextTag) return;
  tagEditingTags = uniqueTags([...tagEditingTags, nextTag]);
  tagEditInput.value = '';
  updateEditingTags();
}

function getRecurrenceBaseDue() {
  if (!recurrenceEditingId) return formatDateKey(new Date());
  const cache = editCache.get(recurrenceEditingId);
  if (cache && cache.due) return cache.due;
  const todo = todos.find((item) => item.id === recurrenceEditingId);
  return todo && todo.due ? todo.due : formatDateKey(new Date());
}

function syncDraftCache() {
  const cache = editCache.get('draft');
  if (!cache) return;
  const nextTitle = draftTitle.textContent.trimStart();
  const nextBody = draftBody.textContent;
  if (nextTitle !== cache.title) {
    cache.title = nextTitle;
    cache.dirty = true;
  }
  if (nextBody !== cache.body) {
    cache.body = nextBody;
    cache.dirty = true;
  }
  if (draftRemind.value !== cache.remind) {
    cache.remind = draftRemind.value;
    cache.dirty = true;
  }
  const nextRecurrence = resolveRecurrenceValues(
    draftRepeat.value,
    draftRepeatEndDate.value,
    draftRepeatEndCount.value,
    draftDue.value
  );
  if (
    nextRecurrence.recurrence !== cache.recurrence ||
    nextRecurrence.recurrenceEnd !== cache.recurrenceEnd ||
    nextRecurrence.recurrenceCount !== cache.recurrenceCount
  ) {
    cache.recurrence = nextRecurrence.recurrence;
    cache.recurrenceEnd = nextRecurrence.recurrenceEnd;
    cache.recurrenceCount = nextRecurrence.recurrenceCount;
    cache.dirty = true;
  }
}

function compareDue(a, b) {
  if (a.due && b.due) return a.due.localeCompare(b.due);
  if (a.due && !b.due) return -1;
  if (!a.due && b.due) return 1;
  return 0;
}

function compareTitle(a, b) {
  return (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
}

function compareCreated(a, b) {
  const aMs = a.createdMs || 0;
  const bMs = b.createdMs || 0;
  return bMs - aMs;
}

function compareUpdated(a, b) {
  const aMs = a.updatedMs || 0;
  const bMs = b.updatedMs || 0;
  return bMs - aMs;
}

function sortItems(items) {
  return items.slice().sort((a, b) => {
    if (a.isDraft && !b.isDraft) return -1;
    if (!a.isDraft && b.isDraft) return 1;
    if (currentTab === 'todo') {
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
    return compareUpdated(a, b);
  });
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function isDoneInDoneTab(todo, today) {
  if (todo.status !== 'done') return false;
  if (!todo.due) return false;
  const yesterdayKey = formatDateKey(addDays(today, -1));
  return todo.due === yesterdayKey;
}

function getSectionKey(todo, todayKey, tomorrowKey, endOfWeekKey, nextWeekKey, isFriday) {
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

async function ensureCacheLoaded(id, todo) {
  if (editCache.has(id)) return;
  if (todo && todo.isDraft) {
    editCache.set(id, {
      title: '',
      body: '',
      due: '',
      status: 'todo',
      remind: 'none',
      priority: 'normal',
      recurrence: 'none',
      recurrenceEnd: null,
      recurrenceCount: null,
      tags: [],
      activeField: null,
      dirty: false,
      originalDue: '',
    });
    return;
  }
  const data = await api.readTodo(id);
  if (!data) return;
  editCache.set(id, {
    title: data.title || '',
    body: data.body || '',
    due: data.due || '',
    status: data.status || 'todo',
    remind: data.remind || 'none',
    priority: data.priority || 'normal',
    recurrence: data.recurrence || 'none',
    recurrenceEnd: data.recurrenceEnd || null,
    recurrenceCount: typeof data.recurrenceCount === 'number' ? data.recurrenceCount : null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    activeField: null,
    dirty: false,
    originalDue: data.due || '',
  });
}

function computeStatusForSave(cache, isNew) {
  if (cache.status === 'done') return 'done';
  if (!isNew && cache.due && cache.due !== cache.originalDue) return 'deferred';
  return cache.status === 'deferred' ? 'deferred' : 'todo';
}

async function autoSaveActive() {
  if (isSaving) return;
  const id = selectedId;
  if (!id) return;
  if (id === 'draft') {
    syncDraftCache();
  }
  const cache = editCache.get(id);
  if (!cache) return;
  syncActiveCacheFromDom(cache);
  if (id === 'draft' && isDraftEmpty(cache)) {
    draft = null;
    editCache.delete('draft');
    selectedId = null;
    renderList();
    updateTabLabels();
    return;
  }
  if (!cache.dirty && id !== 'draft') return;

  isSaving = true;
  await saveTodo(id, cache, { silent: true });
  cache.activeField = null;
  isSaving = false;
}

function renderList() {
  listEl.innerHTML = '';
  let items = todos;
  const today = new Date();
  if (currentTab === 'done') {
    items = items.filter((todo) => !todo.isDraft && isDoneInDoneTab(todo, today));
  } else {
    items = items.filter((todo) => todo.isDraft || !isDoneInDoneTab(todo, today));
  }
  if (currentTagFilter && currentTagFilter !== 'all') {
    items = items.filter((todo) => todoMatchesTag(todo, currentTagFilter));
  }
  const overallEmpty = todos.length === 0 && !draft;
  appEl.classList.toggle('empty', overallEmpty);
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'todo-item';
    if (currentTagFilter && currentTagFilter !== 'all') {
      empty.textContent = `No todos tagged "${currentTagFilter}".`;
    } else {
      empty.textContent =
        currentTab === 'done'
          ? 'No done todos yet.'
          : 'No todos yet. Click + or press Ctrl+N.';
    }
    listEl.appendChild(empty);
    return;
  }

  if (currentTab === 'todo') {
    const todayKey = formatDateKey(today);
    const tomorrowKey = formatDateKey(addDays(today, 1));
    const endOfWeekKey = formatDateKey(addDays(today, (7 - today.getDay()) % 7));
    const nextWeekKey = formatDateKey(addDays(today, 7));
    const isFriday = today.getDay() === 5;
    const sections = isFriday
      ? [
          { key: 'today', label: 'Due today' },
          { key: 'nextWeek', label: 'Due next week' },
          { key: 'rest', label: 'Rest of todos' },
        ]
      : [
          { key: 'today', label: 'Due today' },
          { key: 'tomorrow', label: 'Due tomorrow' },
          { key: 'thisWeek', label: 'Due by end of the week' },
          { key: 'rest', label: 'Rest of todos' },
        ];

    const bucketed = sections.reduce((acc, section) => {
      acc[section.key] = [];
      return acc;
    }, {});

    items.forEach((todo) => {
      const key = getSectionKey(todo, todayKey, tomorrowKey, endOfWeekKey, nextWeekKey, isFriday);
      bucketed[key].push(todo);
    });

    let rowIndex = 0;
    sections.forEach((section) => {
      const sectionItems = sortItems(bucketed[section.key] || []);
      if (!sectionItems.length) return;
      listEl.appendChild(buildSectionHeader(section.label, sectionItems));
      sectionItems.forEach((todo) => renderTodoItem(todo, rowIndex++));
    });
    return;
  }

  const sortedItems = sortItems(items);
  let rowIndex = 0;
  sortedItems.forEach((todo) => {
    renderTodoItem(todo, rowIndex++);
  });
}

function buildSectionHeader(label, items) {
  const header = document.createElement('div');
  header.className = 'section-header with-actions';
  const title = document.createElement('span');
  title.textContent = label;
  const actionsWrap = document.createElement('div');
  actionsWrap.className = 'section-actions';
  const markDoneBtn = document.createElement('button');
  markDoneBtn.className = 'icon plain';
  markDoneBtn.title = `Mark ${label} todos as done`;
  markDoneBtn.textContent = '✓✓';
  markDoneBtn.addEventListener('click', async (event) => {
    event.stopPropagation();
    await bulkMarkTodosDone(items, label);
  });
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'icon plain danger-text';
  deleteBtn.title = `Delete ${label} todos`;
  deleteBtn.textContent = '🧹';
  deleteBtn.addEventListener('click', async (event) => {
    event.stopPropagation();
    await bulkDeleteTodos(items, label);
  });
  actionsWrap.appendChild(markDoneBtn);
  actionsWrap.appendChild(deleteBtn);
  header.appendChild(title);
  header.appendChild(actionsWrap);
  return header;
}

function renderTodoItem(todo, rowIndex = 0) {
    const id = todo.isDraft ? 'draft' : todo.id;
    const item = document.createElement('div');
    item.className = 'todo-item';
    if (rowIndex % 2 === 1) {
      item.classList.add('row-alt');
    }
    const isActive = id === selectedId;
    if (isActive) item.classList.add('active');
    item.addEventListener('click', async () => {
      if (id === selectedId) return;
      await autoSaveActive();
      await selectTodo(id, todo);
    });

    const cache = editCache.get(id);
    let activeCache = cache;
    if (isActive && !activeCache) {
      editCache.set(id, {
        title: getTodoTitle(todo),
        body: '',
        due: todo.due || '',
        status: todo.status || 'todo',
        remind: todo.remind || 'none',
        priority: todo.priority || 'normal',
        recurrence: todo.recurrence || 'none',
        recurrenceEnd: todo.recurrenceEnd || null,
        recurrenceCount: typeof todo.recurrenceCount === 'number' ? todo.recurrenceCount : null,
        tags: Array.isArray(todo.tags) ? todo.tags : [],
        dirty: false,
        originalDue: todo.due || '',
      });
      activeCache = editCache.get(id);
    }

    const header = document.createElement('div');
    header.className = 'todo-header';

    if (!todo.isDraft) {
      const doneToggle = document.createElement('label');
      doneToggle.className = 'done-toggle';
      doneToggle.addEventListener('click', (event) => {
        event.stopPropagation();
      });
      const doneInput = document.createElement('input');
      doneInput.type = 'checkbox';
      doneInput.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      const isDone = (activeCache ? activeCache.status : todo.status) === 'done';
      doneInput.checked = isDone;
      const updateDoneTooltip = () => {
        const label = doneInput.checked ? 'Mark as not done' : 'Mark as done';
        doneInput.title = label;
        doneToggle.title = label;
      };
      updateDoneTooltip();
      doneInput.addEventListener('change', async (event) => {
        event.stopPropagation();
        const targetDone = doneInput.checked;
        const cached = editCache.get(id);
        const listTodo = todos.find((t) => t.id === id) || todo;
        const today = new Date();
        const wasInDoneTab = isDoneInDoneTab({ ...listTodo, status: isDone ? 'done' : listTodo.status }, today);
        const willBeInDoneTab = isDoneInDoneTab(
          { ...listTodo, status: targetDone ? 'done' : 'todo' },
          today
        );
        if (isActive && activeCache) {
          syncActiveCacheFromDom(activeCache);
          activeCache.status = targetDone ? 'done' : 'todo';
          activeCache.dirty = true;
          await api.saveTodo({
            id,
            title: activeCache.title || getTodoTitle(todo),
            body: activeCache.body || '',
            due: activeCache.due || null,
            status: targetDone ? 'done' : 'todo',
            remind: activeCache.remind || 'none',
            priority: activeCache.priority || todo.priority || 'normal',
            recurrence: activeCache.recurrence || todo.recurrence || 'none',
            recurrenceEnd:
              activeCache.recurrenceEnd || todo.recurrenceEnd || null,
            recurrenceCount:
              typeof activeCache.recurrenceCount === 'number'
                ? activeCache.recurrenceCount
                : typeof todo.recurrenceCount === 'number'
                  ? todo.recurrenceCount
                  : null,
            tags: Array.isArray(activeCache.tags)
              ? activeCache.tags
              : Array.isArray(todo.tags)
                ? todo.tags
                : [],
          });
          activeCache.dirty = false;
          activeCache.originalDue = activeCache.due || '';
        } else {
          const data = await api.readTodo(id);
          if (!data) return;
          await api.saveTodo({
            id: data.id,
            title: data.title,
            body: data.body,
            due: data.due,
            status: targetDone ? 'done' : 'todo',
            remind: data.remind || 'none',
            priority: data.priority || 'normal',
            recurrence: data.recurrence || 'none',
            recurrenceEnd: data.recurrenceEnd || null,
            recurrenceCount:
              typeof data.recurrenceCount === 'number' ? data.recurrenceCount : null,
            tags: Array.isArray(data.tags) ? data.tags : [],
          });
        }
        if (cached) {
          cached.status = targetDone ? 'done' : 'todo';
          cached.dirty = false;
          cached.originalDue = cached.due || '';
        }
        if (listTodo) {
          listTodo.status = targetDone ? 'done' : 'todo';
          listTodo.updatedMs = Date.now();
        }
        const shouldRefresh = sortKey === 'updated' || wasInDoneTab !== willBeInDoneTab;
        if (shouldRefresh) {
          await loadTodos();
        } else {
          updateMeta();
          updateTabLabels();
        }
        updateDoneTooltip();
      });
      doneToggle.appendChild(doneInput);
      header.appendChild(doneToggle);
    }

    const headerLeft = document.createElement('div');
    headerLeft.className = 'todo-header-left';
    const title = document.createElement('div');
    title.className = 'todo-title';
    let titleText = getTodoTitle(todo);
    if (activeCache) {
      if (todo.isDraft) {
        titleText = activeCache.title ?? '';
      } else if (activeCache.title) {
        titleText = activeCache.title;
      }
    }
    title.textContent = titleText;

    const meta = document.createElement('div');
    meta.className = 'todo-meta';
    const metaRow = document.createElement('div');
    metaRow.className = 'todo-meta-row';
    const statusSpan = document.createElement('span');
    statusSpan.className = 'todo-status';
    const prioritySpan = document.createElement('span');
    prioritySpan.className = 'todo-priority';
    const recurrenceSpan = document.createElement('span');
    recurrenceSpan.className = 'todo-recurrence';
    const dueSlot = document.createElement('span');
    dueSlot.className = 'todo-due';
    const remindSlot = document.createElement('span');
    remindSlot.className = 'todo-remind';
    metaRow.appendChild(statusSpan);
    metaRow.appendChild(prioritySpan);
    metaRow.appendChild(recurrenceSpan);
    metaRow.appendChild(dueSlot);
    metaRow.appendChild(remindSlot);
    meta.appendChild(metaRow);
    const tagsRow = document.createElement('div');
    tagsRow.className = 'tag-list todo-tags';
    meta.appendChild(tagsRow);

    const remindSelect = document.createElement('select');
    remindSelect.className = 'remind-inline';
    [
      { value: 'none', label: 'No reminder' },
      { value: '5m', label: '5 minutes before' },
      { value: '30m', label: '30 minutes before' },
      { value: '1h', label: '1 hour before' },
      { value: '1d', label: '1 day before' },
    ].forEach((optionData) => {
      const option = document.createElement('option');
      option.value = optionData.value;
      option.textContent = optionData.label;
      remindSelect.appendChild(option);
    });
    remindSelect.addEventListener('click', (event) => {
      if (!isActive || !activeCache || activeCache.activeField !== 'due') return;
      event.stopPropagation();
    });
    remindSelect.addEventListener('change', () => {
      if (!isActive || !activeCache || activeCache.activeField !== 'due') return;
      activeCache.remind = remindSelect.value;
      activeCache.dirty = true;
    });
    remindSlot.appendChild(remindSelect);

    const dueInput = document.createElement('input');
    dueInput.type = 'date';
    dueInput.className = 'due-date inline';
    dueInput.addEventListener('click', (event) => {
      if (!isActive || !activeCache) return;
      event.stopPropagation();
      if (activeCache.activeField !== 'due') {
        activateField(id, todo, 'due');
        return;
      }
      if (typeof dueInput.showPicker === 'function') {
        dueInput.showPicker();
      }
    });
    dueInput.addEventListener('focus', () => {
      if (!isActive || !activeCache || activeCache.activeField !== 'due') return;
      suspendAutoSave = true;
      if (typeof dueInput.showPicker === 'function') {
        dueInput.showPicker();
      }
    });
    dueInput.addEventListener('blur', () => {
      suspendAutoSave = false;
    });
    dueInput.addEventListener('change', () => {
      if (!isActive || !activeCache || activeCache.activeField !== 'due') return;
      activeCache.due = dueInput.value;
      activeCache.dirty = true;
      updateMeta();
      suspendAutoSave = false;
    });
    const duePrefix = document.createElement('span');
    duePrefix.className = 'due-prefix';
    duePrefix.textContent = 'Due';
    dueSlot.appendChild(duePrefix);
    dueSlot.appendChild(dueInput);
    dueSlot.addEventListener('click', (event) => {
      event.stopPropagation();
      if (isActive && activeCache && activeCache.activeField === 'due') return;
      activateField(id, todo, 'due');
    });

    const updatedLine = document.createElement('div');
    updatedLine.className = 'todo-updated';

    function updateMeta() {
      const statusValue = activeCache
        ? activeCache.status === 'done'
          ? 'done'
          : activeCache.due && activeCache.due !== activeCache.originalDue
            ? 'deferred'
            : activeCache.status || 'todo'
        : todo.status || 'todo';
      const dueValue = activeCache ? activeCache.due : todo.due;
      if (todo.isDraft) {
        statusSpan.textContent = 'Draft';
        statusSpan.style.display = 'inline-flex';
      } else {
        const showStatus = statusValue !== 'todo';
        statusSpan.textContent = showStatus ? statusLabel(statusValue) : '';
        statusSpan.style.display = showStatus ? 'inline-flex' : 'none';
      }
      const priorityValue = (activeCache && activeCache.priority) || todo.priority || 'normal';
      const isHighPriority = priorityValue === 'high';
      prioritySpan.textContent = isHighPriority ? 'High' : '';
      prioritySpan.style.display = isHighPriority ? 'inline-flex' : 'none';
      const recurrenceValue = (activeCache && activeCache.recurrence) || todo.recurrence || 'none';
      const recurrenceText = recurrenceLabel(recurrenceValue);
      recurrenceSpan.textContent = recurrenceText;
      recurrenceSpan.style.display = recurrenceText ? 'inline-flex' : 'none';
      const remindValue = activeCache ? activeCache.remind : todo.remind;
      remindSelect.value = remindValue || 'none';
      const editable = Boolean(isActive && activeCache && activeCache.activeField === 'due');
      remindSelect.classList.toggle('editable', editable);
      remindSelect.classList.toggle('readonly', !editable);
      remindSelect.tabIndex = editable ? 0 : -1;
      if (!editable) {
        remindSlot.textContent = remindLabel(remindValue);
        remindSlot.classList.toggle('hidden', !remindValue || remindValue === 'none');
      } else {
        remindSlot.classList.remove('hidden');
        if (!remindSlot.contains(remindSelect)) {
          remindSlot.appendChild(remindSelect);
        }
      }
      const dueValueText = dueValue ? dueValue : '';
      dueInput.value = dueValueText;
      const todayKey = formatDateKey(new Date());
      const isOverdue = Boolean(
        dueValue && dueValue < todayKey && statusValue !== 'done'
      );
      dueSlot.classList.toggle('overdue', isOverdue);
      dueInput.classList.toggle('overdue', isOverdue);
      dueInput.classList.toggle('editable', editable);
      dueInput.classList.toggle('readonly', !editable);
      dueInput.tabIndex = editable ? 0 : -1;
      const tags = getTagsForTodo(todo);
      renderTagChips(tagsRow, tags, null);
      tagsRow.classList.toggle('hidden', !tags.length);
      updatedLine.textContent =
        todo.isDraft || !todo.updatedMs ? '' : `Updated ${formatDate(todo.updatedMs)}`;
      updatedLine.style.display = updatedLine.textContent ? 'block' : 'none';
    }

    const canEditText = Boolean(isActive && activeCache);
    if (canEditText) {
      title.contentEditable = 'true';
      title.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
        }
      });
      title.addEventListener('input', () => {
        activeCache.title = title.innerText.trimStart();
        activeCache.dirty = true;
      });
    }
    title.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (isActive) {
        if (activeCache) {
          activeCache.activeField = 'title';
        }
        title.focus();
        return;
      }
      await activateField(id, todo, 'title');
    });

    const body = document.createElement('div');
    body.className = 'todo-body';
    if (canEditText) {
      body.contentEditable = 'true';
      body.innerText = activeCache.body || '';
      body.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
        }
      });
      body.addEventListener('input', () => {
        activeCache.body = body.innerText.replace(/\n+/g, ' ');
        activeCache.dirty = true;
      });
    } else {
      body.textContent = todo.excerpt || '';
    }
    body.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (isActive) {
        if (activeCache) {
          activeCache.activeField = 'body';
        }
        body.focus();
        return;
      }
      await activateField(id, todo, 'body');
    });

    headerLeft.appendChild(title);
    headerLeft.appendChild(meta);

    const headerActions = document.createElement('div');
    headerActions.className = 'todo-header-actions';

    const recurrenceBtn = document.createElement('button');
    recurrenceBtn.className = 'icon plain';
    recurrenceBtn.textContent = '⟳';
    recurrenceBtn.title = 'Edit recurrence';
    recurrenceBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      showRecurrenceModal(id, todo);
    });

    const tagBtn = document.createElement('button');
    tagBtn.className = 'icon plain';
    tagBtn.textContent = '🏷';
    tagBtn.title = 'Edit tags';
    tagBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      showTagModal(id, todo);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon plain danger-text';
    deleteBtn.textContent = '🗑';
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      pendingDeleteId = id;
      renderList();
    });

    const saveBtn = document.createElement('button');
    saveBtn.className = 'icon plain action save';
    saveBtn.title = 'Save';
    saveBtn.textContent = '💾';
    saveBtn.style.visibility = isActive ? 'visible' : 'hidden';
    saveBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (!isActive || !activeCache) return;
      activeCache.activeField = null;
      await saveTodo(id, activeCache, { exit: true });
      renderList();
    });

    headerActions.appendChild(recurrenceBtn);
    if (!todo.isDraft) {
      headerActions.appendChild(tagBtn);
    }
    headerActions.appendChild(deleteBtn);
    headerActions.appendChild(saveBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerActions);
    item.appendChild(header);
    item.appendChild(body);
    item.appendChild(updatedLine);

    if (pendingDeleteId === id) {
      const isRecurring = Boolean(todo && todo.recurrence && todo.recurrence !== 'none');
      const confirmRow = document.createElement('div');
      confirmRow.className = 'delete-confirm';
      confirmRow.addEventListener('click', (event) => event.stopPropagation());

      const confirmText = document.createElement('span');
      confirmText.textContent = isRecurring ? 'Delete recurring todo?' : 'Delete?';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'icon plain';
      cancelBtn.title = 'Cancel delete';
      cancelBtn.textContent = '✕';
      cancelBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        pendingDeleteId = null;
        renderList();
      });

      confirmRow.appendChild(confirmText);
      if (isRecurring) {
        const deleteThisBtn = document.createElement('button');
        deleteThisBtn.className = 'ghost danger-text';
        deleteThisBtn.textContent = 'This';
        deleteThisBtn.title = 'Delete this todo only';
        deleteThisBtn.addEventListener('click', async (event) => {
          event.stopPropagation();
          pendingDeleteId = null;
          await deleteTodo(id, todo);
        });

        const deleteSeriesBtn = document.createElement('button');
        deleteSeriesBtn.className = 'ghost danger-text';
        deleteSeriesBtn.textContent = 'All upcoming';
        deleteSeriesBtn.title = 'Delete this and all upcoming recurrences';
        deleteSeriesBtn.addEventListener('click', async (event) => {
          event.stopPropagation();
          pendingDeleteId = null;
          await deleteTodoSeries(id, todo);
        });

        confirmRow.appendChild(deleteThisBtn);
        confirmRow.appendChild(deleteSeriesBtn);
      } else {
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'icon plain danger-text';
        confirmBtn.title = 'Confirm delete';
        confirmBtn.textContent = '🗑';
        confirmBtn.addEventListener('click', async (event) => {
          event.stopPropagation();
          pendingDeleteId = null;
          await deleteTodo(id, todo);
        });
        confirmRow.appendChild(confirmBtn);
      }
      confirmRow.appendChild(cancelBtn);
      item.appendChild(confirmRow);
    }

    if (isActive && activeCache) {
      remindSlot.addEventListener('click', (event) => event.stopPropagation());
    }

    updateMeta();

    if (pendingFocus && pendingFocus.id === id) {
      const field = pendingFocus.field;
      pendingFocus = null;
      if (field === 'title') {
        title.focus();
      }
      if (field === 'body') {
        body.focus();
      }
      if (field === 'due') {
        dueInput.focus();
        if (typeof dueInput.showPicker === 'function') {
          dueInput.showPicker();
        }
      }
    }

    listEl.appendChild(item);
}

async function bulkMarkTodosDone(items, label) {
  if (currentTab !== 'todo') return;
  await autoSaveActive();
  const today = new Date();
  const candidates = items.filter(
    (todo) => !todo.isDraft && !isDoneInDoneTab(todo, today) && todo.status !== 'done'
  );
  if (!candidates.length) return;
  const ok = confirm(`Mark ${label.toLowerCase()} todos as done?`);
  if (!ok) return;
  for (const todo of candidates) {
    const data = await api.readTodo(todo.id);
    if (!data) continue;
    await api.saveTodo({
      id: data.id,
      title: data.title,
      body: data.body,
      due: data.due,
      status: 'done',
      remind: data.remind || 'none',
      priority: data.priority || 'normal',
      recurrence: data.recurrence || 'none',
      recurrenceEnd: data.recurrenceEnd || null,
      recurrenceCount: typeof data.recurrenceCount === 'number' ? data.recurrenceCount : null,
      tags: Array.isArray(data.tags) ? data.tags : [],
    });
  }
  selectedId = null;
  await loadTodos();
}

async function bulkDeleteTodos(items, label) {
  if (currentTab !== 'todo') return;
  await autoSaveActive();
  const today = new Date();
  const candidates = items.filter((todo) => !todo.isDraft && !isDoneInDoneTab(todo, today));
  if (!candidates.length) return;
  const ok = confirm(`Delete ${label.toLowerCase()} todos?`);
  if (!ok) return;
  for (const todo of candidates) {
    await api.deleteTodo(todo.id);
  }
  if (draft) {
    draft = null;
    editCache.delete('draft');
  }
  selectedId = null;
  await loadTodos();
}

function updateTabLabels() {
  const today = new Date();
  const doneCount = todos.filter((todo) => isDoneInDoneTab(todo, today)).length;
  const todoCount = todos.filter((todo) => !isDoneInDoneTab(todo, today)).length + (draft ? 1 : 0);
  tabTodo.textContent = `Todo (${todoCount})`;
  tabDone.textContent = `Done (${doneCount})`;
}

function setActiveTab(tab) {
  currentTab = tab;
  tabTodo.classList.toggle('active', currentTab === 'todo');
  tabDone.classList.toggle('active', currentTab === 'done');
}

async function triggerNewTodo() {
  await autoSaveActive();
  if (currentTab !== 'todo') {
    setActiveTab('todo');
  }
  ensureDraft();
  selectedId = 'draft';
  renderList();
  updateTabLabels();
  showDraftModal();
}

async function triggerSave() {
  await autoSaveActive();
}

async function loadTodos() {
  try {
    const result = await api.listTodos();
    todos = Array.isArray(result) ? result : [];
  } catch {
    todos = [];
  }
  if (selectedId && selectedId !== 'draft') {
    const current = todos.find((todo) => todo.id === selectedId);
    if (current) {
      await ensureCacheLoaded(selectedId, current);
    } else {
      selectedId = null;
    }
  }
  updateTabLabels();
  updateTagSuggestions();
  updateTagFilterOptions();
  renderList();
}

async function selectTodo(id, todo) {
  selectedId = id;
  pendingDeleteId = null;
  await ensureCacheLoaded(id, todo);
  const cache = editCache.get(id);
  if (cache) {
    cache.activeField = null;
  }
  renderList();
}

async function activateField(id, todo, field) {
  await autoSaveActive();
  selectedId = id;
  pendingDeleteId = null;
  await ensureCacheLoaded(id, todo);
  const cache = editCache.get(id);
  if (cache) {
    cache.activeField = field;
  }
  pendingFocus = { id, field };
  renderList();
}

function ensureDraft() {
  if (draft) return;
  const todayKey = formatDateKey(new Date());
  draft = {
    id: 'draft',
    title: '',
    updatedMs: Date.now(),
    isDraft: true,
  };
  editCache.set('draft', {
    title: '',
    body: '',
    due: todayKey,
    status: 'todo',
    remind: 'none',
    priority: 'normal',
    recurrence: 'none',
    recurrenceEnd: null,
    recurrenceCount: null,
    tags: [],
    activeField: null,
    dirty: false,
    originalDue: todayKey,
  });
}

async function saveTodo(id, cache, options = {}) {
  const { silent = false, exit = false } = options;
  const computedStatus = computeStatusForSave(cache, id === 'draft');
  const payload = {
    id: id === 'draft' ? null : id,
    title: cache.title || 'Untitled',
    body: cache.body || '',
    due: cache.due || null,
    status: computedStatus,
    remind: cache.remind || 'none',
    priority: cache.priority || 'normal',
    recurrence: cache.recurrence || 'none',
    recurrenceEnd: cache.recurrenceEnd || null,
    recurrenceCount: typeof cache.recurrenceCount === 'number' ? cache.recurrenceCount : null,
    tags: Array.isArray(cache.tags) ? cache.tags : [],
  };
  const result = await api.saveTodo(payload);
  if (id === 'draft') {
    draft = null;
    editCache.delete('draft');
  }
  cache.status = computedStatus;
  cache.originalDue = cache.due;
  cache.dirty = false;
  if (id !== 'draft' && result && result.id) {
    const idx = todos.findIndex((todo) => todo.id === result.id);
    if (idx >= 0) {
      todos[idx] = {
        ...todos[idx],
        title: payload.title,
        due: payload.due,
        status: payload.status,
        remind: payload.remind,
        priority: payload.priority,
        recurrence: payload.recurrence,
        recurrenceEnd: payload.recurrenceEnd,
        recurrenceCount: payload.recurrenceCount,
        tags: payload.tags,
        updatedMs: Date.now(),
        excerpt: buildExcerpt(payload.body),
      };
    }
  }
  if (result && result.id && !exit) {
    selectedId = result.id;
  }
  if (exit) {
    selectedId = null;
  }
  const shouldReload = !silent || exit || id === 'draft';
  if (shouldReload) {
    await loadTodos();
  }
  if (exit || id === 'draft') {
    pendingExternalReload = false;
  }
}

async function deleteTodo(id, todo) {
  if (todo && todo.isDraft) {
    draft = null;
    editCache.delete('draft');
    selectedId = null;
    renderList();
    updateTabLabels();
    return;
  }
  await api.deleteTodo(id);
  editCache.delete(id);
  if (selectedId === id) selectedId = null;
  await loadTodos();
}

async function deleteTodoSeries(id, todo) {
  if (todo && todo.isDraft) {
    draft = null;
    editCache.delete('draft');
    selectedId = null;
    renderList();
    updateTabLabels();
    return;
  }
  await api.deleteTodoSeries(id);
  editCache.delete(id);
  if (selectedId === id) selectedId = null;
  await loadTodos();
}

function toggleSettings(force) {
  const shouldShow = typeof force === 'boolean' ? force : settingsPanel.classList.contains('hidden');
  settingsPanel.classList.toggle('hidden', !shouldShow);
}

async function loadSettings() {
  settings = await api.getSettings();
  alwaysOnTopInput.checked = Boolean(settings.alwaysOnTop);
  dockRightInput.checked = Boolean(settings.dockRight);
  widthModeSelect.value = settings.widthMode || 'px';
  widthValueInput.value = settings.widthValue || (widthModeSelect.value === 'percent' ? 25 : 360);
  todosDirInput.value = settings.todosDir || '';
  reminderTimeInput.value = settings.reminderTime || '09:00';
  gitEnabledInput.checked = Boolean(settings.gitEnabled);
  updateWidthConstraints();
  if (widthModeSelect.value === 'percent') {
    widthValueInput.value = String(Math.max(10, Math.min(Number(widthValueInput.value) || 25, 80)));
  } else {
    widthValueInput.value = String(Math.max(260, Number(widthValueInput.value) || 360));
  }
}

function updateWidthConstraints() {
  const mode = widthModeSelect.value;
  if (mode === 'percent') {
    widthValueInput.min = '10';
    widthValueInput.max = '80';
    widthValueInput.step = '1';
  } else {
    widthValueInput.min = '260';
    widthValueInput.max = '800';
    widthValueInput.step = '10';
  }
}

function renderGitStatus(status) {
  if (!gitStatusEl) return;
  if (!status || !status.available) {
    gitStatusEl.classList.add('hidden');
    gitStatusEl.textContent = '';
    return;
  }
  const message = status.message ? `Last commit: ${status.message}` : 'Git sync enabled';
  gitStatusEl.textContent = message;
  gitStatusEl.classList.remove('hidden');
}

async function refreshGitStatus() {
  try {
    const status = await api.getGitStatus();
    renderGitStatus(status);
  } catch {
    renderGitStatus(null);
  }
}

async function populateDisplays() {
  const displays = await api.listDisplays();
  displaySelect.innerHTML = '';
  displayRow.style.display = displays.length > 1 ? 'flex' : 'none';
  displays.forEach((display) => {
    const option = document.createElement('option');
    option.value = display.id;
    option.textContent = display.label;
    if (settings && settings.displayId === display.id) {
      option.selected = true;
    }
    displaySelect.appendChild(option);
  });
}

addBtn.addEventListener('click', async (event) => {
  event.stopPropagation();
  await triggerNewTodo();
});

draftTitle.addEventListener('input', () => {
  const cache = editCache.get('draft');
  if (!cache) return;
  cache.title = draftTitle.textContent.trimStart();
  cache.dirty = true;
});

draftBody.addEventListener('input', () => {
  const cache = editCache.get('draft');
  if (!cache) return;
  cache.body = draftBody.textContent;
  cache.dirty = true;
});

draftDue.addEventListener('click', () => {
  if (typeof draftDue.showPicker === 'function') {
    draftDue.showPicker();
  }
});

draftDue.addEventListener('focus', () => {
  if (typeof draftDue.showPicker === 'function') {
    draftDue.showPicker();
  }
});

draftDue.addEventListener('change', () => {
  const cache = editCache.get('draft');
  if (!cache) return;
  cache.due = draftDue.value;
  cache.dirty = true;
  if (draftRepeat.value && draftRepeat.value !== 'none') {
    const count = parseRecurrenceCount(draftRepeatEndCount.value);
    if (count) {
      const endDate = computeEndDateFromCount(draftDue.value, draftRepeat.value, count);
      draftRepeatEndDate.value = endDate || '';
    } else if (draftRepeatEndDate.value) {
      const computed = computeCountFromEndDate(
        draftDue.value,
        draftRepeat.value,
        draftRepeatEndDate.value
      );
      draftRepeatEndCount.value = computed ? String(computed) : '';
    }
    updateRepeatPreview(
      draftRepeatPreview,
      draftDue.value,
      draftRepeat.value,
      draftRepeatEndDate.value,
      draftRepeatEndCount.value
    );
  }
});

draftRemind.addEventListener('change', () => {
  const cache = editCache.get('draft');
  if (!cache) return;
  cache.remind = draftRemind.value;
  cache.dirty = true;
});

draftRepeat.addEventListener('change', () => {
  const cache = editCache.get('draft');
  if (!cache) return;
  updateRepeatVisibility(
    draftRepeat.value,
    draftRepeatEndDateRow,
    draftRepeatEndCountRow,
    draftRepeatPreview
  );
  if (draftRepeat.value === 'none') {
    draftRepeatEndDate.value = '';
    draftRepeatEndCount.value = '';
  } else {
    const baseDue = draftDue.value || formatDateKey(new Date());
    const count = parseRecurrenceCount(draftRepeatEndCount.value);
    if (count) {
      draftRepeatEndDate.value = computeEndDateFromCount(baseDue, draftRepeat.value, count) || '';
    } else if (draftRepeatEndDate.value) {
      const computed = computeCountFromEndDate(baseDue, draftRepeat.value, draftRepeatEndDate.value);
      draftRepeatEndCount.value = computed ? String(computed) : '';
    }
  }
  updateRepeatPreview(
    draftRepeatPreview,
    draftDue.value,
    draftRepeat.value,
    draftRepeatEndDate.value,
    draftRepeatEndCount.value
  );
  syncDraftCache();
});

draftRepeatEndDate.addEventListener('change', () => {
  if (draftRepeat.value && draftRepeat.value !== 'none') {
    const count = computeCountFromEndDate(draftDue.value, draftRepeat.value, draftRepeatEndDate.value);
    draftRepeatEndCount.value = count ? String(count) : '';
  }
  updateRepeatPreview(
    draftRepeatPreview,
    draftDue.value,
    draftRepeat.value,
    draftRepeatEndDate.value,
    draftRepeatEndCount.value
  );
  syncDraftCache();
});

draftRepeatEndCount.addEventListener('change', () => {
  if (draftRepeat.value && draftRepeat.value !== 'none') {
    const endDate = computeEndDateFromCount(
      draftDue.value,
      draftRepeat.value,
      draftRepeatEndCount.value
    );
    draftRepeatEndDate.value = endDate || '';
  }
  updateRepeatPreview(
    draftRepeatPreview,
    draftDue.value,
    draftRepeat.value,
    draftRepeatEndDate.value,
    draftRepeatEndCount.value
  );
  syncDraftCache();
});

draftTagAdd.addEventListener('click', (event) => {
  event.stopPropagation();
  addDraftTag();
});

draftTagInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  addDraftTag();
});

recurrenceRepeat.addEventListener('change', () => {
  updateRepeatVisibility(
    recurrenceRepeat.value,
    recurrenceEndDateRow,
    recurrenceEndCountRow,
    recurrenceRepeatPreview
  );
  if (recurrenceRepeat.value === 'none') {
    recurrenceEndDate.value = '';
    recurrenceEndCount.value = '';
  } else {
    const baseDue = getRecurrenceBaseDue();
    const count = parseRecurrenceCount(recurrenceEndCount.value);
    if (count) {
      recurrenceEndDate.value = computeEndDateFromCount(
        baseDue,
        recurrenceRepeat.value,
        count
      ) || '';
    } else if (recurrenceEndDate.value) {
      const computed = computeCountFromEndDate(
        baseDue,
        recurrenceRepeat.value,
        recurrenceEndDate.value
      );
      recurrenceEndCount.value = computed ? String(computed) : '';
    }
  }
  const baseDue = getRecurrenceBaseDue();
  updateRepeatPreview(
    recurrenceRepeatPreview,
    baseDue,
    recurrenceRepeat.value,
    recurrenceEndDate.value,
    recurrenceEndCount.value
  );
});

recurrenceEndDate.addEventListener('change', () => {
  if (recurrenceRepeat.value && recurrenceRepeat.value !== 'none') {
    const baseDue = getRecurrenceBaseDue();
    const count = computeCountFromEndDate(baseDue, recurrenceRepeat.value, recurrenceEndDate.value);
    recurrenceEndCount.value = count ? String(count) : '';
  }
  const baseDue = getRecurrenceBaseDue();
  updateRepeatPreview(
    recurrenceRepeatPreview,
    baseDue,
    recurrenceRepeat.value,
    recurrenceEndDate.value,
    recurrenceEndCount.value
  );
});

recurrenceEndCount.addEventListener('change', () => {
  if (recurrenceRepeat.value && recurrenceRepeat.value !== 'none') {
    const baseDue = getRecurrenceBaseDue();
    const endDate = computeEndDateFromCount(
      baseDue,
      recurrenceRepeat.value,
      recurrenceEndCount.value
    );
    recurrenceEndDate.value = endDate || '';
  }
  const baseDue = getRecurrenceBaseDue();
  updateRepeatPreview(
    recurrenceRepeatPreview,
    baseDue,
    recurrenceRepeat.value,
    recurrenceEndDate.value,
    recurrenceEndCount.value
  );
});

recurrenceSave.addEventListener('click', async (event) => {
  event.stopPropagation();
  if (!recurrenceEditingId) return;
  const id = recurrenceEditingId;
  const cache = editCache.get(id);
  let data = null;
  if (cache && id === selectedId) {
    syncActiveCacheFromDom(cache);
    data = {
      id,
      title: cache.title || '',
      body: cache.body || '',
      due: cache.due || null,
      status: cache.status || 'todo',
      remind: cache.remind || 'none',
      priority: cache.priority || 'normal',
    };
  } else {
    data = await api.readTodo(id);
  }
  if (!data) return;
  const resolved = resolveRecurrenceValues(
    recurrenceRepeat.value,
    recurrenceEndDate.value,
    recurrenceEndCount.value,
    data.due || null
  );
  await api.saveTodo({
    id: data.id,
    title: data.title,
    body: data.body,
    due: data.due,
    status: data.status || 'todo',
    remind: data.remind || 'none',
    priority: data.priority || 'normal',
    recurrence: resolved.recurrence,
    recurrenceEnd: resolved.recurrenceEnd,
    recurrenceCount: resolved.recurrenceCount,
    tags: Array.isArray(data.tags) ? data.tags : [],
  });
  if (cache) {
    cache.recurrence = resolved.recurrence;
    cache.recurrenceEnd = resolved.recurrenceEnd;
    cache.recurrenceCount = resolved.recurrenceCount;
    cache.dirty = false;
  }
  hideRecurrenceModal();
  await loadTodos();
});

recurrenceClose.addEventListener('click', (event) => {
  event.stopPropagation();
  hideRecurrenceModal();
});

tagEditAdd.addEventListener('click', (event) => {
  event.stopPropagation();
  addEditingTag();
});

tagEditInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  addEditingTag();
});

tagSave.addEventListener('click', async (event) => {
  event.stopPropagation();
  if (!tagEditingId) return;
  const id = tagEditingId;
  const cache = editCache.get(id);
  let data = null;
  if (cache && id === selectedId) {
    syncActiveCacheFromDom(cache);
    data = {
      id,
      title: cache.title || '',
      body: cache.body || '',
      due: cache.due || null,
      status: cache.status || 'todo',
      remind: cache.remind || 'none',
      priority: cache.priority || 'normal',
      recurrence: cache.recurrence || 'none',
      recurrenceEnd: cache.recurrenceEnd || null,
      recurrenceCount: typeof cache.recurrenceCount === 'number' ? cache.recurrenceCount : null,
    };
  } else {
    data = await api.readTodo(id);
  }
  if (!data) return;
  const nextTags = uniqueTags(tagEditingTags);
  await api.saveTodo({
    id: data.id,
    title: data.title,
    body: data.body,
    due: data.due,
    status: data.status || 'todo',
    remind: data.remind || 'none',
    priority: data.priority || 'normal',
    recurrence: data.recurrence || 'none',
    recurrenceEnd: data.recurrenceEnd || null,
    recurrenceCount: typeof data.recurrenceCount === 'number' ? data.recurrenceCount : null,
    tags: nextTags,
  });
  if (cache) {
    cache.tags = nextTags;
    cache.dirty = false;
  }
  hideTagModal();
  await loadTodos();
});

tagClose.addEventListener('click', (event) => {
  event.stopPropagation();
  hideTagModal();
});

draftSave.addEventListener('click', async (event) => {
  event.stopPropagation();
  const cache = editCache.get('draft');
  if (!cache) return;
  syncDraftCache();
  await saveTodo('draft', cache, { exit: true });
  hideDraftModal();
});

draftClose.addEventListener('click', (event) => {
  event.stopPropagation();
  draft = null;
  editCache.delete('draft');
  selectedId = null;
  hideDraftModal();
  renderList();
  updateTabLabels();
  flushPendingExternalReload();
});

tabTodo.addEventListener('click', async () => {
  if (currentTab === 'todo') return;
  await autoSaveActive();
  selectedId = null;
  setActiveTab('todo');
  renderList();
});

tabDone.addEventListener('click', async () => {
  if (currentTab === 'done') return;
  await autoSaveActive();
  selectedId = null;
  setActiveTab('done');
  renderList();
});

sortSelect.addEventListener('change', async () => {
  await autoSaveActive();
  sortKey = sortSelect.value;
  renderList();
});

tagFilterSelect.addEventListener('change', async () => {
  await autoSaveActive();
  currentTagFilter = tagFilterSelect.value;
  renderList();
});

settingsToggle.addEventListener('click', () => toggleSettings());
settingsClose.addEventListener('click', () => toggleSettings(false));

alwaysOnTopInput.addEventListener('change', async () => {
  await api.setSettings({ alwaysOnTop: alwaysOnTopInput.checked });
});

dockRightInput.addEventListener('change', async () => {
  await api.setSettings({ dockRight: dockRightInput.checked });
});

widthModeSelect.addEventListener('change', async () => {
  updateWidthConstraints();
  const widthMode = widthModeSelect.value;
  let widthValue = Number(widthValueInput.value);
  if (widthMode === 'percent') {
    widthValue = Math.max(10, Math.min(widthValue || 25, 80));
  } else {
    widthValue = Math.max(260, widthValue || 360);
  }
  widthValueInput.value = String(widthValue);
  await api.setSettings({ widthMode, widthValue });
});

widthValueInput.addEventListener('change', async () => {
  let widthValue = Number(widthValueInput.value);
  if (widthModeSelect.value === 'percent') {
    widthValue = Math.max(10, Math.min(widthValue || 25, 80));
  } else {
    widthValue = Math.max(260, widthValue || 360);
  }
  widthValueInput.value = String(widthValue);
  await api.setSettings({ widthValue });
});

displaySelect.addEventListener('change', async () => {
  const id = Number(displaySelect.value);
  await api.setSettings({ displayId: id });
});

todosDirInput.addEventListener('change', async () => {
  const next = todosDirInput.value.trim();
  await api.setSettings({ todosDir: next || null });
  editCache.clear();
  draft = null;
  selectedId = null;
  await loadTodos();
  await refreshGitStatus();
});

reminderTimeInput.addEventListener('change', async () => {
  const value = reminderTimeInput.value || '09:00';
  await api.setSettings({ reminderTime: value });
});

gitEnabledInput.addEventListener('change', async () => {
  await api.setSettings({ gitEnabled: gitEnabledInput.checked });
  await refreshGitStatus();
});

api.onDisplaysChanged(async () => {
  await populateDisplays();
});

api.onShortcut((action) => {
  if (action === 'new') {
    triggerNewTodo();
  }
  if (action === 'save') {
    triggerSave();
  }
});

api.onTodosChanged(() => {
  handleExternalTodosChanged();
});

api.onGitStatus((status) => {
  renderGitStatus(status);
});

document.addEventListener(
  'pointerdown',
  async (event) => {
    if (recurrenceModalOpen) {
      if (recurrenceCard.contains(event.target)) return;
      hideRecurrenceModal();
      return;
    }
    if (tagModalOpen) {
      if (tagCard.contains(event.target)) return;
      hideTagModal();
      return;
    }
    if (draftModalOpen) {
      if (draftCard.contains(event.target)) return;
      const cache = editCache.get('draft');
      if (cache) {
        syncDraftCache();
        if (isDraftEmpty(cache)) {
          draft = null;
          editCache.delete('draft');
          selectedId = null;
          hideDraftModal();
          renderList();
          updateTabLabels();
          return;
        }
        await saveTodo('draft', cache, { exit: true });
        hideDraftModal();
      }
      return;
    }
    const activeItem = listEl.querySelector('.todo-item.active');
    if (!activeItem) return;
    if (suspendAutoSave) return;
    if (activeItem.contains(event.target)) return;
    await autoSaveActive();
    selectedId = null;
    pendingDeleteId = null;
    renderList();
    await flushPendingExternalReload();
  },
  true
);

function handleShortcut(event) {
  const isCtrl = event.ctrlKey || event.metaKey;
  if (!isCtrl) return;
  const key = event.key.toLowerCase();
  if (key === 'n') {
    event.preventDefault();
    triggerNewTodo();
  }
  if (key === 's') {
    event.preventDefault();
    triggerSave();
  }
}

window.addEventListener('keydown', handleShortcut, true);

function shouldDeferReload() {
  return draftModalOpen || recurrenceModalOpen || tagModalOpen || selectedId !== null || isSaving;
}

async function handleExternalTodosChanged() {
  if (shouldDeferReload()) {
    pendingExternalReload = true;
    return;
  }
  await loadTodos();
}

async function flushPendingExternalReload() {
  if (!pendingExternalReload) return;
  if (shouldDeferReload()) return;
  pendingExternalReload = false;
  await loadTodos();
}

(async () => {
  await loadSettings();
  await populateDisplays();
  await loadTodos();
  await refreshGitStatus();
  setActiveTab('todo');
  sortSelect.value = sortKey;
})();

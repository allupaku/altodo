import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppSettings, DisplayInfo, GitStatus } from '../../../shared/models/settings';
import type { TodoDetail, TodoListItem, TodoSavePayload, TodoStatus } from '../../../shared/models/todo';
import type { EditCache, SortKey, TabKey } from './types';
import {
  collectAllTags,
  computeCountFromEndDate,
  computeEndDateFromCount,
  parseBatchInput,
  parseRecurrenceCount,
} from './todoUtils';
import { formatDateKey } from '../../../shared/utils/date';

interface RecurrenceDraft {
  todoId: string | null;
  recurrence: TodoDetail['recurrence'];
  endDate: string;
  endCount: string;
  baseDue: string;
}

interface TagDraft {
  todoId: string | null;
  tags: string[];
}

interface UseTodoControllerResult {
  todos: TodoListItem[];
  selectedId: string | null;
  activeCache: EditCache | null;
  draftCache: EditCache | null;
  currentTab: TabKey;
  sortKey: SortKey;
  filterText: string;
  settings: AppSettings | null;
  displays: DisplayInfo[];
  gitStatus: GitStatus | null;
  pendingDeleteId: string | null;
  draftOpen: boolean;
  recurrenceDraft: RecurrenceDraft | null;
  tagDraft: TagDraft | null;
  batchDraft: boolean;
  batchValue: string;
  allTags: string[];
  actions: {
    setCurrentTab: (tab: TabKey) => void;
    setSortKey: (key: SortKey) => void;
    setFilterText: (value: string) => void;
    triggerNewTodo: () => void;
    selectTodo: (todo: TodoListItem) => void;
    activateField: (field: EditCache['activeField']) => void;
    updateActiveCache: (patch: Partial<EditCache>) => void;
    updateDraftCache: (patch: Partial<EditCache>) => void;
    saveActive: (options?: { exit?: boolean }) => Promise<void>;
    saveDraft: () => Promise<void>;
    discardDraft: () => void;
    toggleDone: (todo: TodoListItem, done: boolean) => Promise<void>;
    deleteTodo: (todo: TodoListItem) => Promise<void>;
    deleteTodoSeries: (todo: TodoListItem) => Promise<void>;
    setPendingDeleteId: (id: string | null) => void;
    openRecurrenceModal: (todo: TodoListItem) => Promise<void>;
    closeRecurrenceModal: () => void;
    updateRecurrenceDraft: (patch: Partial<RecurrenceDraft>) => void;
    saveRecurrenceDraft: () => Promise<void>;
    openTagModal: (todo: TodoListItem) => Promise<void>;
    closeTagModal: () => void;
    updateTagDraft: (tags: string[]) => void;
    saveTagDraft: () => Promise<void>;
    openBatch: () => void;
    closeBatch: () => void;
    updateBatchValue: (value: string) => void;
    saveBatch: () => Promise<void>;
    setSettings: (next: Partial<AppSettings>) => Promise<void>;
    refreshGitStatus: () => Promise<void>;
    reloadTodos: () => Promise<void>;
    bulkMarkDone: (items: TodoListItem[], label: string) => Promise<void>;
    bulkDelete: (items: TodoListItem[], label: string) => Promise<void>;
    setSuspendAutoSave: (value: boolean) => void;
    moveTodoDue: (id: string, due: string | null, order?: number | null) => Promise<void>;
    reorderTodos: (ids: string[]) => Promise<void>;
  };
}

function createCacheFromDetail(detail: TodoDetail): EditCache {
  return {
    id: detail.id,
    title: detail.title || '',
    body: detail.body || '',
    due: detail.due || '',
    status: detail.status || 'todo',
    remind: detail.remind || 'none',
    priority: detail.priority || 'normal',
    recurrence: detail.recurrence || 'none',
    recurrenceEnd: detail.recurrenceEnd || null,
    recurrenceCount: typeof detail.recurrenceCount === 'number' ? detail.recurrenceCount : null,
    tags: detail.tags || [],
    order: detail.order ?? null,
    dirty: false,
    originalDue: detail.due || '',
    activeField: null,
  };
}

function createDraftCache(): EditCache {
  const todayKey = formatDateKey(new Date());
  return {
    id: 'draft',
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
    order: null,
    dirty: false,
    originalDue: todayKey,
    activeField: null,
  };
}

function computeStatusForSave(cache: EditCache, isNew: boolean): TodoStatus {
  if (cache.status === 'done') return 'done';
  if (!isNew && cache.due && cache.due !== cache.originalDue) return 'deferred';
  return cache.status === 'deferred' ? 'deferred' : 'todo';
}

export function useTodoController(): UseTodoControllerResult {
  const api = window.todoApi;
  const [todos, setTodos] = useState<TodoListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCache, setActiveCache] = useState<EditCache | null>(null);
  const [draftCache, setDraftCache] = useState<EditCache | null>(null);
  const [currentTab, setCurrentTab] = useState<TabKey>('todo');
  const [sortKey, setSortKey] = useState<SortKey>('due');
  const [filterText, setFilterText] = useState('');
  const [settings, setSettingsState] = useState<AppSettings | null>(null);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [recurrenceDraft, setRecurrenceDraft] = useState<RecurrenceDraft | null>(null);
  const [tagDraft, setTagDraft] = useState<TagDraft | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchValue, setBatchValue] = useState('');
  const isSavingRef = useRef(false);
  const pendingExternalReload = useRef(false);
  const suspendAutoSave = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const draftOpenRef = useRef(false);
  const recurrenceDraftRef = useRef<RecurrenceDraft | null>(null);
  const tagDraftRef = useRef<TagDraft | null>(null);
  const batchOpenRef = useRef(false);
  const triggerNewTodoRef = useRef<() => void>(() => {});
  const saveActiveRef = useRef<() => void>(() => {});

  const allTags = useMemo(() => collectAllTags(todos), [todos]);


  const reloadTodos = useCallback(async () => {
    try {
      const result = await api.listTodos();
      setTodos(Array.isArray(result) ? result : []);
    } catch {
      setTodos([]);
    }
  }, [api]);

  const loadSettings = useCallback(async () => {
    const result = await api.getSettings();
    setSettingsState(result);
  }, [api]);

  const populateDisplays = useCallback(async () => {
    const result = await api.listDisplays();
    setDisplays(Array.isArray(result) ? result : []);
  }, [api]);

  const refreshGitStatus = useCallback(async () => {
    try {
      const status = await api.getGitStatus();
      setGitStatus(status);
    } catch {
      setGitStatus(null);
    }
  }, [api]);

  const ensureActiveCache = useCallback(
    async (todoId: string) => {
      const detail = await api.readTodo(todoId);
      if (!detail) return null;
      const cache = createCacheFromDetail(detail);
      setActiveCache(cache);
      return cache;
    },
    [api]
  );

  const triggerNewTodo = useCallback(async () => {
    await saveActive();
    if (!draftCache) {
      setDraftCache(createDraftCache());
    }
    setDraftOpen(true);
  }, [draftCache, saveActive]);

  const changeTab = useCallback(
    async (tab: TabKey) => {
      await saveActive({ exit: true });
      setSelectedId(null);
      setCurrentTab(tab);
    },
    [saveActive]
  );

  const changeSort = useCallback(
    async (key: SortKey) => {
      await saveActive();
      setSortKey(key);
    },
    [saveActive]
  );

  const selectTodo = useCallback(
    async (todo: TodoListItem) => {
      if (selectedId === todo.id) return;
      await saveActive();
      setSelectedId(todo.id);
      setPendingDeleteId(null);
      await ensureActiveCache(todo.id);
    },
    [selectedId, ensureActiveCache, saveActive]
  );

  const activateField = useCallback(
    (field: EditCache['activeField']) => {
      if (!activeCache) return;
      setActiveCache({ ...activeCache, activeField: field });
    },
    [activeCache]
  );

  const updateActiveCache = useCallback(
    (patch: Partial<EditCache>) => {
      if (!activeCache) return;
      setActiveCache({ ...activeCache, ...patch, dirty: true });
    },
    [activeCache]
  );

  const updateDraftCache = useCallback(
    (patch: Partial<EditCache>) => {
      if (!draftCache) return;
      setDraftCache({ ...draftCache, ...patch, dirty: true });
    },
    [draftCache]
  );

  async function saveTodoPayload(payload: TodoSavePayload, exit?: boolean) {
    await api.saveTodo(payload);
    await reloadTodos();
    if (exit) {
      setSelectedId(null);
      setActiveCache(null);
    }
  }

  async function saveActive(options: { exit?: boolean } = {}) {
    if (isSavingRef.current) return;
    if (!activeCache || !selectedId) return;
    if (!activeCache.dirty && !options.exit) return;
    isSavingRef.current = true;
    try {
      const computedStatus = computeStatusForSave(activeCache, false);
      const payload: TodoSavePayload = {
        id: selectedId,
        title: activeCache.title || 'Untitled',
        body: activeCache.body || '',
        due: activeCache.due || null,
        status: computedStatus,
        remind: activeCache.remind || 'none',
        priority: activeCache.priority || 'normal',
        recurrence: activeCache.recurrence || 'none',
        recurrenceEnd: activeCache.recurrenceEnd || null,
        recurrenceCount: typeof activeCache.recurrenceCount === 'number' ? activeCache.recurrenceCount : null,
        tags: activeCache.tags || [],
        order: activeCache.order ?? null,
      };
      await saveTodoPayload(payload, options.exit);
      setActiveCache({
        ...activeCache,
        status: computedStatus,
        dirty: false,
        originalDue: activeCache.due || '',
      });
    } catch (error) {
      console.error('Failed to save todo', error);
    } finally {
      isSavingRef.current = false;
    }
  }

  async function saveDraft() {
    if (isSavingRef.current || !draftCache) return;
    if (!draftCache.title.trim() && !draftCache.body.trim()) {
      setDraftCache(null);
      setDraftOpen(false);
      return;
    }
    isSavingRef.current = true;
    try {
      const payload: TodoSavePayload = {
        id: null,
        title: draftCache.title || 'Untitled',
        body: draftCache.body || '',
        due: draftCache.due || null,
        status: computeStatusForSave(draftCache, true),
        remind: draftCache.remind || 'none',
        priority: draftCache.priority || 'normal',
        recurrence: draftCache.recurrence || 'none',
        recurrenceEnd: draftCache.recurrenceEnd || null,
        recurrenceCount: typeof draftCache.recurrenceCount === 'number' ? draftCache.recurrenceCount : null,
        tags: draftCache.tags || [],
        order: draftCache.order ?? null,
      };
      await saveTodoPayload(payload, true);
      setDraftCache(null);
      setDraftOpen(false);
    } catch (error) {
      console.error('Failed to save draft todo', error);
    } finally {
      isSavingRef.current = false;
    }
  }

  function discardDraft() {
    setDraftCache(null);
    setDraftOpen(false);
  }

  async function toggleDone(todo: TodoListItem, done: boolean) {
    const detail = await api.readTodo(todo.id);
    if (!detail) return;
    await api.saveTodo({
      id: detail.id,
      title: detail.title,
      body: detail.body,
      due: detail.due,
      status: done ? 'done' : 'todo',
      remind: detail.remind || 'none',
      priority: detail.priority || 'normal',
      recurrence: detail.recurrence || 'none',
      recurrenceEnd: detail.recurrenceEnd || null,
      recurrenceCount: detail.recurrenceCount || null,
      tags: detail.tags || [],
      order: detail.order ?? null,
    });
    if (selectedId === todo.id && activeCache) {
      setActiveCache({ ...activeCache, status: done ? 'done' : 'todo', dirty: false });
    }
    await reloadTodos();
  }

  async function deleteTodo(todo: TodoListItem) {
    await api.deleteTodo(todo.id);
    setPendingDeleteId(null);
    await reloadTodos();
  }

  async function deleteTodoSeries(todo: TodoListItem) {
    await api.deleteTodoSeries(todo.id);
    setPendingDeleteId(null);
    await reloadTodos();
  }

  const openRecurrenceModal = useCallback(
    async (todo: TodoListItem) => {
      const detail = await api.readTodo(todo.id);
      if (!detail) return;
      const baseDue = detail.due || formatDateKey(new Date());
      const computedEnd =
        detail.recurrenceEnd ||
        (typeof detail.recurrenceCount === 'number'
          ? computeEndDateFromCount(baseDue, detail.recurrence, detail.recurrenceCount)
          : null);
      const computedCount =
        typeof detail.recurrenceCount === 'number'
          ? detail.recurrenceCount
          : detail.recurrenceEnd
            ? computeCountFromEndDate(baseDue, detail.recurrence, detail.recurrenceEnd)
            : null;
      setRecurrenceDraft({
        todoId: detail.id,
        recurrence: detail.recurrence,
        endDate: computedEnd || '',
        endCount: computedCount ? String(computedCount) : '',
        baseDue,
      });
    },
    [api]
  );

  function closeRecurrenceModal() {
    setRecurrenceDraft(null);
  }

  function updateRecurrenceDraft(patch: Partial<RecurrenceDraft>) {
    if (!recurrenceDraft) return;
    setRecurrenceDraft({ ...recurrenceDraft, ...patch });
  }

  async function saveRecurrenceDraft() {
    if (!recurrenceDraft) return;
    const detail = await api.readTodo(recurrenceDraft.todoId || '');
    if (!detail) return;
    const baseDue = recurrenceDraft.baseDue || detail.due || formatDateKey(new Date());
    let count = parseRecurrenceCount(recurrenceDraft.endCount);
    let endDate = recurrenceDraft.endDate || '';
    if (!endDate && count) {
      endDate = computeEndDateFromCount(baseDue, recurrenceDraft.recurrence, count) || '';
    }
    if (!count && endDate) {
      count = computeCountFromEndDate(baseDue, recurrenceDraft.recurrence, endDate);
    }
    await api.saveTodo({
      id: detail.id,
      title: detail.title,
      body: detail.body,
      due: detail.due,
      status: detail.status,
      remind: detail.remind,
      priority: detail.priority,
      recurrence: recurrenceDraft.recurrence,
      recurrenceEnd: endDate || null,
      recurrenceCount: count ?? null,
      tags: detail.tags || [],
      order: detail.order ?? null,
    });
    setRecurrenceDraft(null);
    await reloadTodos();
  }

  const openTagModal = useCallback(
    async (todo: TodoListItem) => {
      const detail = await api.readTodo(todo.id);
      if (!detail) return;
      setTagDraft({ todoId: detail.id, tags: detail.tags || [] });
    },
    [api]
  );

  function closeTagModal() {
    setTagDraft(null);
  }

  function updateTagDraft(tags: string[]) {
    if (!tagDraft) return;
    setTagDraft({ ...tagDraft, tags });
  }

  function openBatch() {
    setBatchOpen(true);
  }

  function closeBatch() {
    setBatchOpen(false);
    setBatchValue('');
  }

  function updateBatchValue(value: string) {
    setBatchValue(value);
  }

  async function saveBatch() {
    if (!batchValue.trim()) {
      closeBatch();
      return;
    }
    const fallbackDue = formatDateKey(new Date());
    const items = parseBatchInput(batchValue, fallbackDue);
    if (!items.length) {
      closeBatch();
      return;
    }
    for (const item of items) {
      await api.saveTodo({
        id: null,
        title: item.title,
        body: '',
        due: item.due,
        status: 'todo',
        remind: 'none',
        priority: 'normal',
        recurrence: 'none',
        recurrenceEnd: null,
        recurrenceCount: null,
        tags: item.tags,
        order: null,
      });
    }
    await reloadTodos();
    closeBatch();
  }

  async function saveTagDraft() {
    if (!tagDraft) return;
    const detail = await api.readTodo(tagDraft.todoId || '');
    if (!detail) return;
    await api.saveTodo({
      id: detail.id,
      title: detail.title,
      body: detail.body,
      due: detail.due,
      status: detail.status,
      remind: detail.remind,
      priority: detail.priority,
      recurrence: detail.recurrence,
      recurrenceEnd: detail.recurrenceEnd,
      recurrenceCount: detail.recurrenceCount,
      tags: tagDraft.tags,
      order: detail.order ?? null,
    });
    setTagDraft(null);
    await reloadTodos();
  }

  async function setSettings(next: Partial<AppSettings>) {
    const updated = await api.setSettings(next);
    setSettingsState(updated);
    if (next.todosDir !== undefined) {
      await reloadTodos();
      await refreshGitStatus();
    }
  }

  async function bulkMarkDone(items: TodoListItem[], label: string) {
    if (!items.length) return;
    const ok = confirm(`Mark ${label.toLowerCase()} todos as done?`);
    if (!ok) return;
    for (const todo of items) {
      const detail = await api.readTodo(todo.id);
      if (!detail) continue;
      await api.saveTodo({
        id: detail.id,
        title: detail.title,
        body: detail.body,
        due: detail.due,
        status: 'done',
        remind: detail.remind,
        priority: detail.priority,
        recurrence: detail.recurrence,
        recurrenceEnd: detail.recurrenceEnd,
        recurrenceCount: detail.recurrenceCount,
        tags: detail.tags,
        order: detail.order ?? null,
      });
    }
    await reloadTodos();
  }

  async function bulkDelete(items: TodoListItem[], label: string) {
    if (!items.length) return;
    const ok = confirm(`Delete ${label.toLowerCase()} todos?`);
    if (!ok) return;
    for (const todo of items) {
      await api.deleteTodo(todo.id);
    }
    await reloadTodos();
  }

  async function moveTodoDue(id: string, due: string | null, order?: number | null) {
    await api.moveTodoDue(id, due, order ?? null);
    await reloadTodos();
  }

  async function reorderTodos(ids: string[]) {
    await api.reorderTodos(ids);
    await reloadTodos();
  }

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    draftOpenRef.current = draftOpen;
  }, [draftOpen]);

  useEffect(() => {
    recurrenceDraftRef.current = recurrenceDraft;
  }, [recurrenceDraft]);

  useEffect(() => {
    tagDraftRef.current = tagDraft;
  }, [tagDraft]);

  useEffect(() => {
    batchOpenRef.current = batchOpen;
  }, [batchOpen]);

  useEffect(() => {
    triggerNewTodoRef.current = () => {
      triggerNewTodo();
    };
  }, [triggerNewTodo]);

  useEffect(() => {
    saveActiveRef.current = () => {
      saveActive({ exit: true }).catch(() => {});
    };
  }, [saveActive]);

  useEffect(() => {
    loadSettings().catch(() => {});
    populateDisplays().catch(() => {});
    reloadTodos().catch(() => {});
    refreshGitStatus().catch(() => {});

    api.onTodosChanged(() => {
      if (
        draftOpenRef.current ||
        recurrenceDraftRef.current ||
        tagDraftRef.current ||
        batchOpenRef.current ||
        selectedIdRef.current ||
        isSavingRef.current
      ) {
        pendingExternalReload.current = true;
        return;
      }
      reloadTodos().catch(() => {});
    });
    api.onDisplaysChanged(() => {
      populateDisplays().catch(() => {});
    });
    api.onGitStatus((status) => setGitStatus(status));
    api.onShortcut((action) => {
      if (action === 'new') {
        triggerNewTodoRef.current();
      }
      if (action === 'save') {
        saveActiveRef.current();
      }
    });
  }, [api, loadSettings, populateDisplays, reloadTodos, refreshGitStatus]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (recurrenceDraftRef.current || tagDraftRef.current || batchOpenRef.current) return;
      if (draftOpenRef.current) return;
      if (!selectedIdRef.current) return;
      if (suspendAutoSave.current) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const activeItem = document.querySelector('.todo-item.active');
      if (activeItem && activeItem.contains(target)) return;
      saveActive({ exit: true }).catch(() => {});
      if (pendingExternalReload.current) {
        pendingExternalReload.current = false;
        reloadTodos().catch(() => {});
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [selectedId, activeCache, draftOpen, recurrenceDraft, tagDraft]);

  return {
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
    batchDraft: batchOpen,
    batchValue,
    allTags,
    actions: {
      setCurrentTab: changeTab,
      setSortKey: changeSort,
      setFilterText,
      triggerNewTodo,
      selectTodo,
      activateField,
      updateActiveCache,
      updateDraftCache,
      saveActive,
      saveDraft,
      discardDraft,
      toggleDone,
      deleteTodo,
      deleteTodoSeries,
      setPendingDeleteId,
      openRecurrenceModal,
      closeRecurrenceModal,
      updateRecurrenceDraft,
      saveRecurrenceDraft,
      openTagModal,
      closeTagModal,
      updateTagDraft,
      saveTagDraft,
      openBatch,
      closeBatch,
      updateBatchValue,
      saveBatch,
      setSettings,
      refreshGitStatus,
      reloadTodos,
      bulkMarkDone,
      bulkDelete,
      setSuspendAutoSave: (value: boolean) => {
        suspendAutoSave.current = value;
      },
      moveTodoDue,
      reorderTodos,
    },
  };
}

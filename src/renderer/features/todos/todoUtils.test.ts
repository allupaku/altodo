import { describe, expect, it } from 'vitest';
import {
  computeCountFromEndDate,
  computeEndDateFromCount,
  isDoneInDoneTab,
  matchesTagFilter,
  matchesTextFilter,
  parseBatchInput,
  parseFilterTokens,
} from './todoUtils';

describe('todoUtils filters', () => {
  it('parses multi token filters', () => {
    const result = parseFilterTokens('#work tag:boss done urgent');
    expect(result.tagTokens).toEqual(['work', 'boss']);
    expect(result.statusTokens).toEqual(['done']);
    expect(result.textTokens).toEqual(['urgent']);
  });

  it('matches tags using AND semantics', () => {
    expect(matchesTagFilter(['work', 'boss'], ['work', 'boss'])).toBe(true);
    expect(matchesTagFilter(['work'], ['work', 'boss'])).toBe(false);
  });

  it('matches text tokens against combined text', () => {
    expect(matchesTextFilter('review budget report', ['budget'])).toBe(true);
    expect(matchesTextFilter('review budget report', ['budget', 'report'])).toBe(true);
    expect(matchesTextFilter('review budget report', ['budget', 'urgent'])).toBe(false);
  });

  it('treats any done item as done tab eligible', () => {
    const base = {
      id: '1',
      title: 'Test',
      due: null,
      status: 'todo' as const,
      remind: 'none',
      priority: 'normal' as const,
      recurrence: 'none' as const,
      recurrenceEnd: null,
      recurrenceCount: null,
      tags: [],
      createdMs: null,
      updatedMs: null,
      excerpt: '',
      order: null,
    };
    expect(isDoneInDoneTab({ ...base, status: 'done' })).toBe(true);
    expect(isDoneInDoneTab({ ...base, status: 'todo' })).toBe(false);
  });
});

describe('todoUtils recurrence helpers', () => {
  it('computes end date from count', () => {
    expect(computeEndDateFromCount('2026-02-10', 'daily', 3)).toBe('2026-02-12');
  });

  it('computes count from end date', () => {
    expect(computeCountFromEndDate('2026-02-10', 'daily', '2026-02-12')).toBe(3);
  });
});

describe('todoUtils batch parsing', () => {
  it('parses batch input with dates and tags', () => {
    const items = parseBatchInput(
      'Follow up /tags:work,team @2026-02-12\nPrep notes /tags:manager',
      '2026-02-10'
    );
    expect(items).toEqual([
      { title: 'Follow up', due: '2026-02-12', tags: ['work', 'team'] },
      { title: 'Prep notes', due: '2026-02-10', tags: ['manager'] },
    ]);
  });
});

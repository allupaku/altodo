import { describe, expect, it } from 'vitest';
import {
  computeCountFromEndDate,
  computeEndDateFromCount,
  matchesTagFilter,
  matchesTextFilter,
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
});

describe('todoUtils recurrence helpers', () => {
  it('computes end date from count', () => {
    expect(computeEndDateFromCount('2026-02-10', 'daily', 3)).toBe('2026-02-12');
  });

  it('computes count from end date', () => {
    expect(computeCountFromEndDate('2026-02-10', 'daily', '2026-02-12')).toBe(3);
  });
});

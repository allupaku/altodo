import { describe, expect, it } from 'vitest';
import { computeNextDue } from './recurrence';

describe('computeNextDue', () => {
  it('computes daily recurrence', () => {
    expect(computeNextDue('2026-02-10', 'daily')).toBe('2026-02-11');
  });

  it('skips weekends for weekdays recurrence', () => {
    expect(computeNextDue('2026-02-13', 'weekdays')).toBe('2026-02-16');
  });

  it('computes weekly recurrence', () => {
    expect(computeNextDue('2026-02-10', 'weekly:5')).toBe('2026-02-13');
  });

  it('computes biweekly recurrence', () => {
    expect(computeNextDue('2026-02-10', 'biweekly')).toBe('2026-02-24');
  });
});

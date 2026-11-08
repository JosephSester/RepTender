import { describe, it, expect } from 'vitest';
import { atTime, dateKey, parseDateKey } from './dates';

describe('dates', () => {
  it('dateKey formats a local date as yyyy-MM-dd', () => {
    expect(dateKey(new Date(2026, 10, 8, 23, 59))).toBe('2026-11-08');
  });
  it('parseDateKey returns local midnight', () => {
    const d = parseDateKey('2026-03-03');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 3, 0]);
  });
  it('atTime sets the local time of day', () => {
    const d = atTime(new Date(2026, 10, 13, 7, 30), '18:00');
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([13, 18, 0]);
  });
});

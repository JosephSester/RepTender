import { describe, expect, it } from 'vitest';
import { formatDateKey, formatDaysAgo, formatDue, plural } from './format';

const now = new Date(2026, 10, 8, 9, 0);

describe('formatDue', () => {
  it('names today and tomorrow, otherwise shows the date', () => {
    expect(formatDue(new Date(2026, 10, 8, 18, 0), now)).toBe('Today · 6:00 PM');
    expect(formatDue(new Date(2026, 10, 9, 18, 0), now)).toBe('Tomorrow · 6:00 PM');
    expect(formatDue(new Date(2026, 10, 13, 18, 30), now)).toBe('Fri, Nov 13 · 6:30 PM');
    expect(formatDue(null, now)).toBe('No feedings yet');
  });
});

describe('formatDateKey', () => {
  it('formats a stored date or shows a dash', () => {
    expect(formatDateKey('2026-03-03')).toBe('Mar 3, 2026');
    expect(formatDateKey(undefined)).toBe('—');
  });
});

describe('plural / formatDaysAgo', () => {
  it('pluralizes', () => {
    expect(plural(1, 'note')).toBe('1 note');
    expect(plural(3, 'note')).toBe('3 notes');
  });
  it('counts calendar days back', () => {
    expect(formatDaysAgo(new Date(2026, 10, 8, 7, 0), now)).toBe('today');
    expect(formatDaysAgo(new Date(2026, 10, 7, 23, 0), now)).toBe('1 day ago');
    expect(formatDaysAgo(new Date(2026, 10, 6, 8, 0), now)).toBe('2 days ago');
  });
});

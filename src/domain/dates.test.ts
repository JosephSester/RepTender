import { describe, it, expect } from 'vitest';
import { atTime, combineDateTime, dateKey, formatTimeOfDay, isDateKey, isTimeOfDay, parseDateKey } from './dates';

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

describe('input-safe helpers', () => {
  it('isDateKey accepts only real yyyy-MM-dd dates', () => {
    expect(isDateKey('2026-11-08')).toBe(true);
    expect(isDateKey('')).toBe(false);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('11/08/2026')).toBe(false);
  });
  it('isTimeOfDay accepts HH:mm only', () => {
    expect(isTimeOfDay('07:30')).toBe(true);
    expect(isTimeOfDay('')).toBe(false);
    expect(isTimeOfDay('24:00')).toBe(false);
    expect(isTimeOfDay('7:30')).toBe(false);
  });
  it('combineDateTime builds a local date, or null for a cleared or bad input', () => {
    expect(combineDateTime('2026-11-04', '07:30')!.getTime()).toBe(new Date(2026, 10, 4, 7, 30).getTime());
    expect(combineDateTime('', '07:30')).toBeNull();
    expect(combineDateTime('2026-11-04', '')).toBeNull();
    expect(combineDateTime('2026-13-01', '07:30')).toBeNull();
  });
  it('formatTimeOfDay shows a 12-hour time', () => {
    expect(formatTimeOfDay('18:00')).toBe('6:00 PM');
    expect(formatTimeOfDay('08:15')).toBe('8:15 AM');
  });
});

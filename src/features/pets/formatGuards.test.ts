import { describe, expect, it } from 'vitest';
import { formatDateKey, formatDue, formatMoney } from './format';

const now = new Date(2026, 10, 8, 9, 0);

describe('format guards', () => {
  it('formatDue shows a dash for an invalid date instead of throwing', () => {
    expect(formatDue(new Date(Number.NaN), now)).toBe('—');
  });
  it('formatDateKey shows a dash for a malformed key', () => {
    expect(formatDateKey('2026-13-45')).toBe('—');
    expect(formatDateKey('not a date')).toBe('—');
    expect(formatDateKey('2026-03-03')).toBe('Mar 3, 2026');
  });
});

describe('formatMoney', () => {
  it('drops .00 but keeps cents', () => {
    expect(formatMoney(65)).toBe('$65');
    expect(formatMoney(85.5)).toBe('$85.50');
    expect(formatMoney(0.1 + 0.2)).toBe('$0.30');
  });
});

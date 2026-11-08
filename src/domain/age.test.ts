import { describe, it, expect } from 'vitest';
import { formatAge } from './age';

const now = new Date(2026, 10, 8, 12, 0);

describe('formatAge', () => {
  it('uses days under one month', () => {
    expect(formatAge('2026-10-20', now)).toBe('19 days');
    expect(formatAge('2026-11-07', now)).toBe('1 day');
  });
  it('uses months under two years', () => {
    expect(formatAge('2026-03-03', now)).toBe('8 mo');
  });
  it('uses years and months from two years', () => {
    expect(formatAge('2023-06-01', now)).toBe('3 yr 5 mo');
  });
  it('prefixes ~ when the birth date is approximate', () => {
    expect(formatAge('2026-03-03', now, true)).toBe('~8 mo');
  });
});

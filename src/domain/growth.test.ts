import { describe, expect, it } from 'vitest';
import type { Measurement } from './types';
import { chartSeries, formatChange, latestWith, weightChange } from './growth';

const now = new Date(2026, 10, 8, 9, 0);
let n = 0;
const m = (date: string, weightG?: number, lengthMm?: number): Measurement => ({
  id: `m${++n}`, petId: 'p1', date, weightG, lengthMm, createdAt: '', updatedAt: '',
});

describe('latest values', () => {
  it('finds the latest entry that has each value', () => {
    const ms = [m('2026-11-01', 42), m('2026-10-01', 39, 431.8), m('2026-09-01', 36)];
    expect(latestWith(ms, 'weightG')!.date).toBe('2026-11-01');
    expect(latestWith(ms, 'lengthMm')!.date).toBe('2026-10-01');
    expect(latestWith([], 'weightG')).toBeUndefined();
  });
});

describe('weightChange', () => {
  it('compares with the last weight from 30 or more days ago', () => {
    expect(weightChange([m('2026-09-01', 36), m('2026-10-01', 39), m('2026-11-01', 42)], now)).toBe(3);
  });
  it('falls back to the first weight inside the window', () => {
    expect(weightChange([m('2026-10-20', 40), m('2026-11-01', 38)], now)).toBe(-2);
  });
  it('is null with one weight, or when the latest weight is older than the window', () => {
    expect(weightChange([m('2026-11-01', 42)], now)).toBeNull();
    expect(weightChange([m('2026-08-01', 30), m('2026-09-01', 36)], now)).toBeNull();
  });
});

describe('chartSeries', () => {
  const ms = [m('2025-01-15', 10), m('2026-02-01', 25), m('2026-06-01', 33), m('2026-11-01', 42), m('2026-10-01', undefined, 431.8)];
  it('limits to the range and to entries with that value, oldest first', () => {
    expect(chartSeries(ms, 'weightG', '6M', now).map((x) => x.date)).toEqual(['2026-06-01', '2026-11-01']);
    expect(chartSeries(ms, 'weightG', '1Y', now).map((x) => x.date)).toEqual(['2026-02-01', '2026-06-01', '2026-11-01']);
    expect(chartSeries(ms, 'weightG', 'All', now)).toHaveLength(4);
    expect(chartSeries(ms, 'lengthMm', 'All', now)).toHaveLength(1);
  });
});

it('formats a weight change in the user unit', () => {
  expect(formatChange(3, 'g')).toBe('↑ 3 g');
  expect(formatChange(-2.4, 'g')).toBe('↓ 2 g');
  expect(formatChange(0.2, 'g')).toBe('No change');
  expect(formatChange(28.35, 'oz')).toBe('↑ 1 oz');
});

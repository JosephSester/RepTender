import { describe, expect, it } from 'vitest';
import type { HabitatReading } from './types';
import { tempToC } from './units';
import {
  checkRange, formatTargetRange, gauge, lastDays, latestValue, targetRange, weekSummary,
} from './habitat';

let n = 0;
const reading = (at: Date, values: Partial<HabitatReading>): HabitatReading => ({
  id: `r${++n}`, petId: 'p1', at: at.toISOString(), createdAt: '', updatedAt: '', ...values,
});
const day = (d: number, h = 8, m = 15) => new Date(2026, 10, d, h, m);

describe('latestValue / targetRange', () => {
  it('finds the newest reading that has the value', () => {
    const rs = [reading(day(6), { warmC: 31, humidityPct: 50 }), reading(day(7), { warmC: 32 })];
    expect(latestValue(rs, 'warm')).toEqual({ value: 32, at: day(7).toISOString() });
    expect(latestValue(rs, 'humidity')).toEqual({ value: 50, at: day(6).toISOString() });
    expect(latestValue(rs, 'cool')).toBeUndefined();
  });
  it('reads each metric range from the pet targets', () => {
    const t = { warmMinC: 29, warmMaxC: 32, humidityMin: 40 };
    expect(targetRange(t, 'warm')).toEqual({ min: 29, max: 32 });
    expect(targetRange(t, 'cool')).toEqual({ min: undefined, max: undefined });
    expect(targetRange(t, 'humidity')).toEqual({ min: 40, max: undefined });
  });
});

describe('checkRange / gauge', () => {
  it('says low, ok, high or unset', () => {
    expect(checkRange(25, { min: 20, max: 30 })).toBe('ok');
    expect(checkRange(19, { min: 20, max: 30 })).toBe('low');
    expect(checkRange(31, { min: 20, max: 30 })).toBe('high');
    expect(checkRange(31, { min: 20 })).toBe('ok');
    expect(checkRange(31, {})).toBe('unset');
  });
  it('places the target band and the marker as percentages', () => {
    expect(gauge(25, { min: 20, max: 30 })).toEqual({ band: { start: 33.3, end: 66.7 }, marker: 50 });
    expect(gauge(45, { min: 20, max: 30 })).toEqual({ band: { start: 28.6, end: 57.1 }, marker: 100 });
    expect(gauge(25, {})).toEqual({ marker: 50 });
  });
});

describe('formatTargetRange', () => {
  const warm = { min: tempToC(85, 'F'), max: tempToC(90, 'F') };
  it('shows the range in the user unit', () => {
    expect(formatTargetRange('warm', warm, 'F')).toBe('Target 85–90°F');
    expect(formatTargetRange('warm', warm, 'C')).toBe('Target 29.4–32.2°C');
    expect(formatTargetRange('humidity', { min: 40, max: 60 }, 'F')).toBe('Target 40–60%');
    expect(formatTargetRange('cool', { min: tempToC(72, 'F') }, 'F')).toBe('Target ≥ 72°F');
    expect(formatTargetRange('cool', { max: tempToC(78, 'F') }, 'F')).toBe('Target ≤ 78°F');
    expect(formatTargetRange('cool', {}, 'F')).toBe('No target set');
  });
});

describe('the last 7 days', () => {
  const now = day(8, 9, 0);
  const rs = [
    reading(day(1, 8, 0), { warmC: 31 }), // more than 7 days ago
    reading(day(2), { warmC: 31 }),
    reading(day(5), { humidityPct: 50 }),
    reading(day(8), { warmC: 33 }),
  ];
  it('keeps readings of that metric from the last 7 days', () => {
    expect(lastDays(rs, 'warm', now).map((r) => r.warmC)).toEqual([31, 33]);
  });
  it('summarizes the week against the target', () => {
    expect(weekSummary([30, 31], { min: 29, max: 32 })).toBe('In range all week ✓');
    expect(weekSummary([30, 33, 34], { min: 29, max: 32 })).toBe('2 of 3 readings out of range');
    expect(weekSummary([30], {})).toBe('1 reading this week');
    expect(weekSummary([], { min: 29 })).toBe('No readings this week');
  });
});

import { describe, expect, it } from 'vitest';
import { dueStatus, isValidFeedingInterval, MAX_FEEDING_INTERVAL_DAYS, statusLabel } from './feeding';

const now = new Date(2026, 10, 8, 9, 0);

describe('feeding interval limit', () => {
  it('accepts whole days from 1 to 365', () => {
    expect(MAX_FEEDING_INTERVAL_DAYS).toBe(365);
    expect(isValidFeedingInterval(1)).toBe(true);
    expect(isValidFeedingInterval(365)).toBe(true);
    expect(isValidFeedingInterval(0)).toBe(false);
    expect(isValidFeedingInterval(366)).toBe(false);
    expect(isValidFeedingInterval(2.5)).toBe(false);
    expect(isValidFeedingInterval(Number.NaN)).toBe(false);
  });
});

describe('an out-of-range due date never breaks the status', () => {
  it('reads as far away, with a dash for a label', () => {
    const overflowed = new Date(Number.NaN);
    expect(dueStatus(overflowed, now)).toBe('soon');
    expect(statusLabel(overflowed, now)).toBe('—');
  });
});

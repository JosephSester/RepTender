import { describe, expect, it } from 'vitest';
import type { Pet } from '../../domain/types';
import { formatDay, previewNextDue } from './logModel';

const pet = { feedingIntervalDays: 5, usualFeedTime: '18:00' } as Pet;
const now = new Date(2026, 10, 8, 18, 12);
const currentDue = new Date(2026, 10, 8, 18, 0);
const base = { pet, at: now, foundAt: now, pushBack: true, pushBackDays: 10, currentDue };

describe('previewNextDue', () => {
  it('ate: meal day + interval', () => {
    expect(previewNextDue({ ...base, outcome: 'ate' })!.getTime()).toBe(new Date(2026, 10, 13, 18, 0).getTime());
  });
  it('refused: unchanged', () => {
    expect(previewNextDue({ ...base, outcome: 'refused' })).toBe(currentDue);
  });
  it('regurgitated with push-back: found + days', () => {
    expect(previewNextDue({ ...base, outcome: 'regurgitated' })!.getTime()).toBe(new Date(2026, 10, 18, 18, 0).getTime());
  });
  it('regurgitated without push-back: same as ate', () => {
    expect(previewNextDue({ ...base, outcome: 'regurgitated', pushBack: false })!.getTime()).toBe(
      new Date(2026, 10, 13, 18, 0).getTime(),
    );
  });
});

describe('formatDay', () => {
  it('names nearby days', () => {
    expect(formatDay(new Date(2026, 10, 8, 18), now)).toBe('Today');
    expect(formatDay(new Date(2026, 10, 9, 18), now)).toBe('Tomorrow');
    expect(formatDay(new Date(2026, 10, 13, 18), now)).toBe('Fri, Nov 13');
    expect(formatDay(null, now)).toBe('—');
  });
  it('shows a dash for an invalid date instead of throwing', () => {
    expect(formatDay(new Date(NaN), now)).toBe('—');
  });
});

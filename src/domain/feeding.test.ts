import { describe, it, expect } from 'vitest';
import type { Feeding, FeedingOutcome } from './types';
import {
  dueStatus,
  intervalProgress,
  lastMeal,
  nextFeedingDue,
  pushBackOverride,
  statusLabel,
} from './feeding';

const local = (m: number, d: number, h = 18, min = 0) => new Date(2026, m, d, h, min);
let n = 0;
const feeding = (at: Date, outcome: FeedingOutcome = 'ate'): Feeding => ({
  id: `f${++n}`,
  petId: 'p1',
  at: at.toISOString(),
  foodItem: 'Pinky mouse',
  quantity: 1,
  outcome,
  createdAt: at.toISOString(),
  updatedAt: at.toISOString(),
});
const pet = {
  feedingIntervalDays: 5,
  usualFeedTime: '18:00' as string | undefined,
  nextFeedingOverride: undefined as string | undefined,
};

describe('lastMeal', () => {
  it('returns the latest meal that was eaten, ignoring refusals', () => {
    const a = feeding(local(10, 3));
    const r = feeding(local(10, 5), 'refused');
    expect(lastMeal([r, a])).toBe(a);
  });
  it('returns undefined when nothing was eaten', () => {
    expect(lastMeal([feeding(local(10, 5), 'refused')])).toBeUndefined();
  });
});

describe('nextFeedingDue', () => {
  it('is null with no meals', () => {
    expect(nextFeedingDue(pet, [])).toBeNull();
  });
  it('is last meal + interval at the usual feed time', () => {
    const due = nextFeedingDue(pet, [feeding(local(10, 3, 18, 5))])!;
    expect(due.getTime()).toBe(local(10, 8, 18, 0).getTime());
  });
  it('defaults the feed time to 18:00', () => {
    const due = nextFeedingDue({ ...pet, usualFeedTime: undefined }, [feeding(local(10, 3, 9, 0))])!;
    expect(due.getTime()).toBe(local(10, 8, 18, 0).getTime());
  });
  it('a refusal does not reset the clock', () => {
    const due = nextFeedingDue(pet, [feeding(local(10, 3)), feeding(local(10, 8), 'refused')])!;
    expect(due.getTime()).toBe(local(10, 8).getTime());
  });
  it('an override later than the last meal wins', () => {
    const override = local(10, 14).toISOString();
    const due = nextFeedingDue({ ...pet, nextFeedingOverride: override }, [feeding(local(10, 3))])!;
    expect(due.toISOString()).toBe(override);
  });
  it('an override older than the last meal is ignored', () => {
    const override = local(10, 4).toISOString();
    const due = nextFeedingDue({ ...pet, nextFeedingOverride: override }, [feeding(local(10, 6))])!;
    expect(due.getTime()).toBe(local(10, 11).getTime());
  });
});

describe('dueStatus / statusLabel', () => {
  const due = local(10, 8, 18, 0);
  it('today when due later the same calendar day', () => {
    expect(dueStatus(due, local(10, 8, 7, 0))).toBe('today');
    expect(statusLabel(due, local(10, 8, 7, 0))).toBe('Today');
  });
  it('late from the next calendar day', () => {
    expect(dueStatus(due, local(10, 9, 0, 30))).toBe('late');
    expect(statusLabel(due, local(10, 9, 0, 30))).toBe('1 day late');
    expect(statusLabel(due, local(10, 11))).toBe('3 days late');
  });
  it('soon before the due day', () => {
    expect(dueStatus(due, local(10, 6))).toBe('soon');
    expect(statusLabel(due, local(10, 7))).toBe('Tomorrow');
    expect(statusLabel(due, local(10, 4))).toBe('In 4 days');
  });
  it('no meals yet counts as due today', () => {
    expect(dueStatus(null, local(10, 8))).toBe('today');
    expect(statusLabel(null, local(10, 8))).toBe('No feedings yet');
  });
});

describe('intervalProgress', () => {
  const meal = feeding(local(10, 3, 18, 0));
  const due = local(10, 8, 18, 0);
  it('is the fraction of the interval elapsed', () => {
    expect(intervalProgress(meal, due, new Date(2026, 10, 5, 18, 0))).toBeCloseTo(0.4, 5);
  });
  it('caps at 1 when late and is 1 without a meal', () => {
    expect(intervalProgress(meal, due, local(10, 10))).toBe(1);
    expect(intervalProgress(undefined, null, local(10, 10))).toBe(1);
  });
});

describe('pushBackOverride', () => {
  it('is regurgitation date + 10 days at the usual feed time', () => {
    const iso = pushBackOverride(local(10, 4, 7, 30), { usualFeedTime: '18:00' });
    expect(iso).toBe(local(10, 14, 18, 0).toISOString());
  });
  it('accepts a custom number of days', () => {
    const iso = pushBackOverride(local(10, 4, 7, 30), { usualFeedTime: undefined }, 14);
    expect(iso).toBe(local(10, 18, 18, 0).toISOString());
  });
});

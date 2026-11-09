import { describe, expect, it } from 'vitest';
import type { Feeding, FeedingOutcome, Poop } from './types';
import { daysAfterMeal, formatMealGap, formatTypicalGap, poopKindLabel, typicalGap } from './poop';

const t = (m: number, d: number, h = 18) => new Date(2026, m, d, h, 0).toISOString();
const feeding = (at: string, outcome: FeedingOutcome = 'ate'): Feeding => ({
  id: at, petId: 'p1', at, foodItem: 'Pinky mouse', quantity: 1, outcome, createdAt: at, updatedAt: at,
});
const poop = (at: string): Poop => ({ id: at, petId: 'p1', at, kind: 'normal', createdAt: at, updatedAt: at });

describe('daysAfterMeal (spec §7 rule 11)', () => {
  const feedings = [feeding(t(9, 22)), feeding(t(10, 3)), feeding(t(10, 5), 'refused'), feeding(t(10, 7))];

  it('counts calendar days from the latest eaten meal on or before the poop', () => {
    expect(daysAfterMeal(t(10, 6, 8), feedings)).toEqual({ days: 3, mealAt: t(10, 3) });
  });
  it('ignores refusals and meals after the poop', () => {
    expect(daysAfterMeal(t(10, 5, 20), feedings)!.mealAt).toBe(t(10, 3));
  });
  it('a poop the same day as a meal counts 0 days', () => {
    expect(daysAfterMeal(t(10, 7, 21), feedings)).toEqual({ days: 0, mealAt: t(10, 7) });
  });
  it('is null when no meal came before it', () => {
    expect(daysAfterMeal(t(9, 20), feedings)).toBeNull();
  });
  it('formats the gap', () => {
    expect(formatMealGap({ days: 3, mealAt: t(10, 3) })).toBe('3 days after Nov 3 meal');
    expect(formatMealGap({ days: 1, mealAt: t(10, 3) })).toBe('1 day after Nov 3 meal');
    expect(formatMealGap({ days: 0, mealAt: t(10, 3) })).toBe('Same day as Nov 3 meal');
  });
});

describe('typicalGap', () => {
  const feedings = [feeding(t(9, 1)), feeding(t(9, 11)), feeding(t(9, 22)), feeding(t(10, 3))];

  it('is the range over the most recent poops that follow a meal', () => {
    const poops = [poop(t(9, 4, 8)), poop(t(9, 16, 8)), poop(t(9, 26, 8)), poop(t(10, 6, 8))];
    expect(typicalGap(poops, feedings)).toEqual({ min: 3, max: 5 });
  });
  it('needs at least two', () => {
    expect(typicalGap([poop(t(10, 6, 8))], feedings)).toBeNull();
  });
  it('uses only the 5 most recent poops', () => {
    const poops = [poop(t(9, 10, 8)), ...[4, 5, 6, 7, 8].map((d) => poop(t(10, d, 8)))];
    // Oct 10 is 9 days after the Oct 1 meal but is the 6th most recent poop, so it is left out.
    expect(typicalGap(poops, feedings)).toEqual({ min: 1, max: 5 });
  });
  it('formats the range', () => {
    expect(formatTypicalGap({ min: 3, max: 5 })).toBe('Usually 3–5 days after a meal');
    expect(formatTypicalGap({ min: 4, max: 4 })).toBe('Usually 4 days after a meal');
    expect(formatTypicalGap({ min: 1, max: 1 })).toBe('Usually 1 day after a meal');
  });
});

it('labels poop kinds', () => {
  expect(poopKindLabel('urate_only')).toBe('Urate only');
});

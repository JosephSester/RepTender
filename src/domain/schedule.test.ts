import { describe, expect, it } from 'vitest';
import type { CareCompletion, CareTask, Feeding, Pet } from './types';
import { comingUp, todayItems, type CareSource, type FeedingSource } from './schedule';

const now = new Date(2026, 10, 8, 9, 0);
const pet = (name: string, feedingIntervalDays: number, usualFoodItem: string, usualQuantity = 1): Pet => ({
  id: name, name, species: 'Reptile', sex: 'unknown', origin: 'unknown', birthDateApprox: false, feedingIntervalDays,
  usualFoodItem, usualQuantity, usualFeedTime: '18:00', habitatTargets: {}, createdAt: '', updatedAt: '',
});
const ate = (petId: string, m: number, d: number, h = 18): Feeding => ({
  id: `${petId}-${d}`, petId, at: new Date(2026, m, d, h, 0).toISOString(), foodItem: 'x', quantity: 1, outcome: 'ate',
  createdAt: '', updatedAt: '',
});
const task = (id: string, name: string, intervalDays: number, petId?: string): CareTask => ({
  id, petId, name, intervalDays, createdAt: new Date(2026, 9, 1).toISOString(), updatedAt: '',
});
const done = (taskId: string, m: number, d: number, h = 9): CareCompletion => ({
  id: `${taskId}-${d}`, taskId, at: new Date(2026, m, d, h, 0).toISOString(), createdAt: '', updatedAt: '',
});

const basil = pet('Basil', 2, 'Dubia roaches', 12);
const noodle = pet('Noodle', 5, 'Pinky mouse');
const ziggy = pet('Ziggy', 3, 'Crickets', 8);
const pebble = pet('Pebble', 2, 'Greens');
const feedings: FeedingSource[] = [
  { pet: basil, feedings: [ate('Basil', 10, 5)] }, // due Nov 7: late
  { pet: noodle, feedings: [ate('Noodle', 10, 3)] }, // due today 6 PM
  { pet: ziggy, feedings: [ate('Ziggy', 10, 8, 8)] }, // fed this morning: done, next Nov 11
  { pet: pebble, feedings: [] }, // never fed: due now
];
const spot = task('spot', 'Spot clean', 1, 'Basil');
const water = task('water', 'Fresh water', 2);
const deep = task('deep', 'Deep clean', 30, 'Noodle');
const uvb = task('uvb', 'Replace UVB bulb', 180, 'Basil');
const care: CareSource[] = [
  { task: spot, pet: basil, completions: [done('spot', 10, 8, 7)] }, // done today, next Nov 9
  { task: water, completions: [done('water', 10, 6)] }, // due today (midnight)
  { task: deep, pet: noodle, completions: [done('deep', 9, 16)] }, // due Nov 15
  { task: uvb, pet: basil, completions: [done('uvb', 9, 1)] }, // due in 2027
];

describe('todayItems', () => {
  it('lists what is due, late or done today, most urgent first and done last', () => {
    const items = todayItems(feedings, care, now);
    expect(items.map((i) => [i.title, i.status, i.done])).toEqual([
      ['Feed Basil', 'late', false],
      ['Feed Pebble', 'today', false],
      ['Fresh water', 'today', false],
      ['Feed Noodle', 'today', false],
      ['Spot clean', 'soon', true],
      ['Feed Ziggy', 'soon', true],
    ]);
  });
  it('describes each item', () => {
    const items = todayItems(feedings, care, now);
    expect(items.find((i) => i.title === 'Feed Basil')!.detail).toBe('12 Dubia roaches');
    expect(items.find((i) => i.title === 'Fresh water')!.detail).toBe('All pets · every 2 days');
    expect(items.find((i) => i.title === 'Spot clean')!.detail).toBe('Basil · daily');
  });
  it('a refusal today does not count as done', () => {
    const refused: Feeding = { ...ate('Noodle', 10, 8, 8), id: 'r', outcome: 'refused' };
    const items = todayItems([{ pet: noodle, feedings: [ate('Noodle', 10, 3), refused] }], [], now);
    expect(items[0]).toMatchObject({ title: 'Feed Noodle', done: false, status: 'today' });
  });
});

describe('comingUp', () => {
  it('groups the next occurrence of each item over the next 7 days', () => {
    expect(comingUp(feedings, care, now).map((g) => [g.day, g.items.map((i) => i.title)])).toEqual([
      ['2026-11-09', ['Spot clean']],
      ['2026-11-11', ['Feed Ziggy']],
      ['2026-11-15', ['Deep clean']],
    ]);
  });

  it('skips an item whose due date overflowed instead of throwing', () => {
    const huge: CareSource[] = [...care, { task: task('huge', 'Huge', 1_000_000_000, noodle.id), pet: noodle, completions: [] }];
    expect(() => comingUp(feedings, huge, now)).not.toThrow();
    expect(comingUp(feedings, huge, now).flatMap((g) => g.items.map((i) => i.title))).not.toContain('Huge');
  });
});

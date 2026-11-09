import { expect, it } from 'vitest';
import type { CareCompletion, CareTask, Feeding, Pet } from './types';
import { badgeCount } from './schedule';

const now = new Date(2026, 10, 8, 9, 0);
const iso = (d: number, h = 18) => new Date(2026, 10, d, h, 0).toISOString();
const base = { createdAt: iso(1, 8), updatedAt: iso(1, 8) };
const pet = (id: string, interval: number): Pet => ({
  ...base, id, name: id, species: 'Reptile', sex: 'unknown', origin: 'unknown', birthDateApprox: false,
  feedingIntervalDays: interval, usualQuantity: 1, usualFeedTime: '18:00', habitatTargets: {},
});
const ate = (petId: string, d: number, h = 18): Feeding => ({
  ...base, id: `${petId}-${d}`, petId, at: iso(d, h), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate',
});
const task = (id: string, intervalDays: number): CareTask => ({ ...base, id, name: id, intervalDays });
const done = (taskId: string, d: number, h = 9): CareCompletion => ({ ...base, id: `${taskId}-${d}`, taskId, at: iso(d, h) });

it('counts late and due-today feedings and care tasks that are not done yet', () => {
  const feedings = [
    { pet: pet('late', 2), feedings: [ate('late', 5)] }, // late
    { pet: pet('today', 5), feedings: [ate('today', 3)] }, // due today
    { pet: pet('fed', 3), feedings: [ate('fed', 8, 8)] }, // fed this morning: done
    { pet: pet('soon', 7), feedings: [ate('soon', 7)] }, // next week
    { pet: pet('new', 7), feedings: [] }, // never fed: due now
  ];
  const care = [
    { task: task('water', 2), completions: [done('water', 6)] }, // due today
    { task: task('clean', 1), completions: [done('clean', 8, 7)] }, // done today
    { task: task('uvb', 180), completions: [done('uvb', 1)] }, // months away
  ];
  expect(badgeCount(feedings, care, now)).toBe(4);
  expect(badgeCount([], [], now)).toBe(0);
});

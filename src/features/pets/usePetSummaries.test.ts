import { describe, expect, it } from 'vitest';
import type { Feeding, Pet } from '../../domain/types';
import { sortSummaries, summarize } from './usePetSummaries';

const now = new Date(2026, 10, 8, 9, 0);
const pet = (name: string, feedingIntervalDays: number): Pet => ({
  id: name, name, species: 'Corn Snake', sex: 'unknown', origin: 'unknown', birthDateApprox: false,
  feedingIntervalDays, usualQuantity: 1, usualFeedTime: '18:00', habitatTargets: {},
  createdAt: '', updatedAt: '',
});
const ate = (petId: string, day: number): Feeding => ({
  id: `${petId}-${day}`, petId, at: new Date(2026, 10, day, 18, 0).toISOString(),
  foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate', createdAt: '', updatedAt: '',
});

describe('summarize', () => {
  it('computes due date, status, label and progress', () => {
    const s = summarize(pet('Noodle', 5), [ate('Noodle', 3)], now);
    expect(s.status).toBe('today');
    expect(s.label).toBe('Today');
    expect(s.due!.getDate()).toBe(8);
    expect(s.progress).toBeGreaterThan(0.85);
  });
});

describe('sortSummaries', () => {
  it('puts late first, then today, then soonest', () => {
    const list = [
      summarize(pet('Ziggy', 3), [ate('Ziggy', 7)], now), // due Nov 10
      summarize(pet('Noodle', 5), [ate('Noodle', 3)], now), // due today
      summarize(pet('Basil', 2), [ate('Basil', 5)], now), // due Nov 7: late
      summarize(pet('Pebble', 2), [ate('Pebble', 7)], now), // due Nov 9
    ];
    expect(sortSummaries(list).map((s) => s.pet.name)).toEqual(['Basil', 'Noodle', 'Pebble', 'Ziggy']);
  });
});

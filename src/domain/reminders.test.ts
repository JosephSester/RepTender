import { describe, expect, it } from 'vitest';
import type { CareCompletion, CareTask, Feeding, Pet, VetVisit } from './types';
import { allReminders, CARE_REMINDER_TIME, careEvent, careEventStart, feedingEvent, vetEvent } from './reminders';

const now = new Date(2026, 10, 8, 9, 0);
const iso = (d: number, h = 18, m = 0) => new Date(2026, 10, d, h, m).toISOString();
const base = { createdAt: iso(1, 8), updatedAt: iso(1, 8) };

function pet(id: string, name: string, interval: number, extra: Partial<Pet> = {}): Pet {
  return {
    ...base, id, name, species: 'Reptile', sex: 'unknown', origin: 'unknown', birthDateApprox: false,
    feedingIntervalDays: interval, usualQuantity: 1, usualFeedTime: '18:00', habitatTargets: {}, ...extra,
  };
}
const meal = (petId: string, d: number): Feeding => ({
  ...base, id: `f-${petId}-${d}`, petId, at: iso(d), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate',
});
const task = (id: string, name: string, intervalDays: number, extra: Partial<CareTask> = {}): CareTask => ({
  ...base, id, name, intervalDays, ...extra,
});
const done = (taskId: string, d: number, h = 9): CareCompletion => ({ ...base, id: `c-${taskId}-${d}`, taskId, at: iso(d, h) });

describe('single events', () => {
  it('a feeding: "Feed <name> · <qty> <food>" at the due time, 15 minutes', () => {
    const due = new Date(2026, 10, 13, 18, 0);
    const e = feedingEvent(pet('p1', 'Noodle', 5, { usualFoodItem: 'Pinky mouse' }), due);
    expect(e).toMatchObject({ uid: 'p1-2026-11-13@reptender', title: 'Feed Noodle · 1 Pinky mouse', durationMinutes: 15 });
    expect(e.start.getTime()).toBe(due.getTime());
    expect(feedingEvent(pet('p2', 'Ziggy', 3), due).title).toBe('Feed Ziggy');
  });

  it('a care task: at its time of day, or 09:00 when it has none', () => {
    const day = new Date(2026, 10, 9);
    expect(CARE_REMINDER_TIME).toBe('09:00');
    expect(careEventStart(task('t1', 'Mist', 2), day).getTime()).toBe(new Date(2026, 10, 9, 9, 0).getTime());
    const timed = new Date(2026, 10, 9, 20, 30);
    expect(careEventStart(task('t1', 'Mist', 2, { timeOfDay: '20:30' }), timed).getTime()).toBe(timed.getTime());
    expect(careEvent(task('t1', 'Mist', 2), 'Ziggy', day)).toMatchObject({ uid: 't1-2026-11-09@reptender', title: 'Mist · Ziggy' });
    expect(careEvent(task('t2', 'Fresh water', 2), undefined, day).title).toBe('Fresh water · All pets');
  });

  it('a vet appointment: one hour, with the clinic as the location', () => {
    const visit: Pick<VetVisit, 'id' | 'nextAppointment' | 'clinic' | 'reason'> = {
      id: 'v1', nextAppointment: new Date(2027, 5, 14, 10, 0).toISOString(), reason: 'Wellness exam',
    };
    const e = vetEvent('Noodle', visit, 'Exotic Animal Clinic')!;
    expect(e).toMatchObject({
      uid: 'v1-2027-06-14@reptender', title: 'Vet · Noodle', durationMinutes: 60,
      location: 'Exotic Animal Clinic', description: 'Follow-up after: Wellness exam',
    });
    expect(e.start.getTime()).toBe(new Date(2027, 5, 14, 10, 0).getTime());
    expect(vetEvent('Noodle', { id: 'v2' })).toBeNull();
    expect(vetEvent('Noodle', { id: 'v3', nextAppointment: 'garbage' })).toBeNull();
  });
});

describe('allReminders (Add all reminders)', () => {
  it('has the next occurrence of every feeding and care task, soonest first, skipping past ones', () => {
    const noodle = pet('p1', 'Noodle', 5, { usualFoodItem: 'Pinky mouse' }); // fed Nov 3 → today 18:00
    const basil = pet('p2', 'Basil', 2); // fed Nov 5 → Nov 7: late, skipped
    const ziggy = pet('p3', 'Ziggy', 3); // fed Nov 8 → Nov 11
    const newbie = pet('p4', 'Newbie', 7); // never fed: no due date, skipped
    const huge = pet('p5', 'Overflow', 999999999); // out-of-range stored interval: skipped, no crash
    const events = allReminders(
      [
        { pet: noodle, feedings: [meal('p1', 3)] },
        { pet: basil, feedings: [meal('p2', 5)] },
        { pet: ziggy, feedings: [meal('p3', 8)] },
        { pet: newbie, feedings: [] },
        { pet: huge, feedings: [meal('p5', 1)] },
      ],
      [
        { task: task('t1', 'Spot clean', 1), pet: basil, completions: [done('t1', 7)] }, // today 09:00: just past
        { task: task('t2', 'Fresh water', 2), completions: [done('t2', 7)] }, // Nov 9 09:00
        { task: task('t3', 'Mist', 1, { timeOfDay: '20:00' }), pet: ziggy, completions: [done('t3', 7, 20)] }, // today 20:00
      ],
      now,
    );
    expect(events.map((e) => e.title)).toEqual([
      'Feed Noodle · 1 Pinky mouse', 'Mist · Ziggy', 'Fresh water · All pets', 'Feed Ziggy',
    ]);
    expect(events.map((e) => e.uid)).toEqual([
      'p1-2026-11-08@reptender', 't3-2026-11-08@reptender', 't2-2026-11-09@reptender', 'p3-2026-11-11@reptender',
    ]);
    expect(events[2]!.start.getTime()).toBe(new Date(2026, 10, 9, 9, 0).getTime());
  });
});

import { isValid, parseISO } from 'date-fns';
import type { CareTask, Pet, VetVisit } from './types';
import { atTime } from './dates';
import { nextFeedingDue } from './feeding';
import { careNextDue } from './care';
import type { CareSource, FeedingSource } from './schedule';
import { eventUid, type CalendarEvent } from './ics';

/** A care task with no time of day is reminded at this time on its due day. */
export const CARE_REMINDER_TIME = '09:00';

const FEEDING_MINUTES = 15;
const CARE_MINUTES = 15;
const VET_MINUTES = 60;

/** Spec §8 "Feed Noodle · 1 pinky mouse" at the next due date and time. */
export function feedingEvent(pet: Pick<Pet, 'id' | 'name' | 'usualFoodItem' | 'usualQuantity'>, due: Date): CalendarEvent {
  return {
    uid: eventUid(pet.id, due),
    title: pet.usualFoodItem ? `Feed ${pet.name} · ${pet.usualQuantity} ${pet.usualFoodItem}` : `Feed ${pet.name}`,
    start: due,
    durationMinutes: FEEDING_MINUTES,
  };
}

/** careNextDue() is the start of the day when the task has no time of day: remind at 09:00 instead. */
export function careEventStart(task: Pick<CareTask, 'timeOfDay'>, due: Date): Date {
  return task.timeOfDay ? due : atTime(due, CARE_REMINDER_TIME);
}

export function careEvent(task: Pick<CareTask, 'id' | 'name' | 'timeOfDay'>, petName: string | undefined, due: Date): CalendarEvent {
  return {
    uid: eventUid(task.id, due),
    title: `${task.name} · ${petName ?? 'All pets'}`,
    start: careEventStart(task, due),
    durationMinutes: CARE_MINUTES,
  };
}

/** The visit's next appointment, or null when it has none (or it can't be read). */
export function vetEvent(
  petName: string,
  visit: Pick<VetVisit, 'id' | 'nextAppointment' | 'clinic' | 'reason'>,
  clinic?: string,
): CalendarEvent | null {
  if (!visit.nextAppointment) return null;
  const start = parseISO(visit.nextAppointment);
  if (!isValid(start)) return null;
  return {
    uid: eventUid(visit.id, start),
    title: `Vet · ${petName}`,
    start,
    durationMinutes: VET_MINUTES,
    location: visit.clinic ?? clinic,
    description: visit.reason ? `Follow-up after: ${visit.reason}` : undefined,
  };
}

const upcoming = (start: Date, now: Date) => isValid(start) && start.getTime() > now.getTime();

/**
 * Spec §8 "Add all reminders": the next occurrence of every feeding and care task.
 * Past ones (late, or earlier today) are skipped: an alert in the past never fires.
 */
export function allReminders(feedings: readonly FeedingSource[], care: readonly CareSource[], now: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const { pet, feedings: list } of feedings) {
    const due = nextFeedingDue(pet, list);
    if (due && upcoming(due, now)) events.push(feedingEvent(pet, due));
  }
  for (const { task, pet, completions } of care) {
    const due = careNextDue(task, completions);
    if (!isValid(due)) continue;
    const event = careEvent(task, pet?.name, due);
    if (upcoming(event.start, now)) events.push(event);
  }
  return events.sort((a, b) => a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title));
}

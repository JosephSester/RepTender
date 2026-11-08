import { differenceInDays, differenceInMonths } from 'date-fns';
import { parseDateKey } from './dates';

/** Spec §7 rule 7. */
export function formatAge(birthDate: string, now: Date, approx = false): string {
  const born = parseDateKey(birthDate);
  const months = differenceInMonths(now, born);
  let text: string;
  if (months < 1) {
    const days = differenceInDays(now, born);
    text = `${days} day${days === 1 ? '' : 's'}`;
  } else if (months < 24) {
    text = `${months} mo`;
  } else {
    text = `${Math.floor(months / 12)} yr ${months % 12} mo`;
  }
  return approx ? `~${text}` : text;
}

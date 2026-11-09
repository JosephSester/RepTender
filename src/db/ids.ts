import { isValid, parseISO } from 'date-fns';
import { isDateKey } from '../domain/dates';

export const newId = (): string => crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();

/** Bad user input. Screens show `message` next to the form. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Trimmed text, or undefined for blank (so an emptied field is removed from the record). */
export const cleanText = (s?: string): string | undefined => s?.trim() || undefined;

export function requireDateKey(date: string, message = 'Pick a date'): void {
  if (!isDateKey(date)) throw new ValidationError(message);
}

export function requireDateTime(at: string, message = 'Pick a date and time'): void {
  if (!isValid(parseISO(at))) throw new ValidationError(message);
}

/** The inline message a form shows when saving fails (spec §11). */
export function saveErrorText(err: unknown): string {
  return err instanceof ValidationError ? err.message : 'Could not save. Please try again.';
}

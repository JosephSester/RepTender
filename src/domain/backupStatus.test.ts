import { expect, it } from 'vitest';
import { BACKUP_REMINDER_DAYS, backupStatus } from './backupStatus';

const now = new Date(2026, 10, 8, 9, 0);
const daysAgo = (n: number, h = 20) => new Date(2026, 10, 8 - n, h, 0).toISOString();

it('says when the last backup was, by calendar day', () => {
  expect(backupStatus(undefined, now)).toEqual({ text: 'Never backed up', overdue: true });
  expect(backupStatus('garbage', now)).toEqual({ text: 'Never backed up', overdue: true });
  expect(backupStatus(new Date(2026, 10, 8, 7, 0).toISOString(), now)).toEqual({ text: 'Last backup today', overdue: false });
  expect(backupStatus(daysAgo(1), now)).toEqual({ text: 'Last backup 1 day ago', overdue: false });
  expect(backupStatus(daysAgo(3), now)).toEqual({ text: 'Last backup 3 days ago', overdue: false });
});

it('turns amber after 30 days', () => {
  expect(BACKUP_REMINDER_DAYS).toBe(30);
  expect(backupStatus(daysAgo(30), now).overdue).toBe(false);
  expect(backupStatus(daysAgo(31), now)).toEqual({ text: 'Last backup 31 days ago', overdue: true });
});

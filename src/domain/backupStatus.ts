import { differenceInCalendarDays, isValid, parseISO } from 'date-fns';

/** Spec §9: Settings shows the last backup in amber after this many days. */
export const BACKUP_REMINDER_DAYS = 30;

export interface BackupStatus {
  text: string;
  /** Amber: never backed up, or more than BACKUP_REMINDER_DAYS ago. */
  overdue: boolean;
}

export function backupStatus(lastBackupAt: string | undefined, now: Date): BackupStatus {
  const last = lastBackupAt ? parseISO(lastBackupAt) : undefined;
  if (!last || !isValid(last)) return { text: 'Never backed up', overdue: true };
  const days = Math.max(0, differenceInCalendarDays(now, last));
  const text = days === 0 ? 'Last backup today' : `Last backup ${days} day${days === 1 ? '' : 's'} ago`;
  return { text, overdue: days > BACKUP_REMINDER_DAYS };
}

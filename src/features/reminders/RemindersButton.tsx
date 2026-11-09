import { useState } from 'react';
import { allReminders } from '../../domain/reminders';
import { deliverFile } from '../../lib/deliver';
import { plural } from '../pets/format';
import type { ScheduleSources } from '../schedule/scheduleSources';
import { ALL_REMINDERS_FILE, calendarFile } from './calendarFile';

interface Props {
  sources: ScheduleSources | undefined;
  label: string;
  /** Tests only; otherwise the moment of the tap. */
  now?: Date;
}

/** Spec §8 "Add all reminders": one .ics with the next occurrence of every feeding and care task. */
export function RemindersButton({ sources, label, now }: Props) {
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string>();
  const [error, setError] = useState<string>();

  const onClick = async () => {
    if (!sources || sharing) return;
    const stamp = now ?? new Date();
    setError(undefined);
    const events = allReminders(sources.feedings, sources.care, stamp);
    if (events.length === 0) {
      setNote('Nothing coming up to remind you about.');
      return;
    }
    setSharing(true);
    setNote(undefined);
    try {
      // Built synchronously, so the share sheet opens inside the tap (see deliverFile).
      const result = await deliverFile(calendarFile(events, ALL_REMINDERS_FILE, stamp));
      const count = plural(events.length, 'reminder');
      if (result === 'shared') setNote(`Shared ${count}.`);
      if (result === 'downloaded') setNote(`Downloaded ${ALL_REMINDERS_FILE} (${count}). Open it to add them to Calendar.`);
    } catch {
      setError("Couldn't create the calendar file.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div>
      <button type="button" className="btn-ghost" disabled={!sources || sharing} onClick={onClick}>
        {label}
      </button>
      {error && <div role="alert" className="form-error">{error}</div>}
      {note && <p role="status" className="muted setting-note">{note}</p>}
    </div>
  );
}
